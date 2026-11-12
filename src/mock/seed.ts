// Sample dealership. Dates are set relative to "now" so the queue always has work in it.
import type { Call, CallOutcome, Customer, Lead, LeadSource, LeadStatus, Policy, Quote, Vehicle } from '../domain/types';
import { allocateLead } from '../rules/allocation';
import { addDays, dateIn } from '../rules/time';
import type { Db, MockUser } from './store';

const MIN = 60_000;
const DAYMS = 86_400_000;

interface SeedLead {
  name: string; mobile: string; lang: string; model: string; reg: string; ev?: boolean;
  source: LeadSource; status: LeadStatus; expIn: number;
  insurer: string; type: Policy['policyType']; premium: number | null; idv: number | null; ncb: number | null;
  by?: string; byYear?: number; first?: boolean; // who renewed or issued it before
  why: string; nextMin: number | null; promised?: boolean; aiQ?: number; // aiQ = minutes ago the AI qualified it
  dnc?: boolean;
  quotes?: [string, number | null, 'live' | 'manual', number?][]; // insurer, premium, kind, link valid for minutes
  calls?: [number, 'me' | 'ai', boolean, CallOutcome, string][]; // minutes ago, by, connected, outcome, note
}

const LEADS: SeedLead[] = [
  { name: 'Priya Sharma', mobile: '9848012210', lang: 'Hindi', model: 'Venue S(O)', reg: 'TS08 GH 1123', source: 'renewal_from_service', status: 'callback', expIn: 12, insurer: 'Bajaj Allianz', type: 'OD+TP', premium: 21400, idv: 742000, ncb: 20, by: 'Anitha', byYear: 1, why: 'Callback promised · wants one quote for both cars', nextMin: -10, promised: true, quotes: [['Cholamandalam', 22150, 'live', 30], ['Reliance General', 22980, 'manual']], calls: [[30, 'me', true, 'call_later', 'Picked up, asked for a call in 20 minutes'], [1460, 'me', false, 'no_answer', '']] },
  { name: 'Mohammed Irfan', mobile: '9701044519', lang: 'Hindi', model: 'Verna SX', reg: 'TS08 JQ 9012', source: 'renewal_from_sales', status: 'hot', expIn: 17, insurer: 'SBI General', type: 'OD+TP', premium: 24100, idv: 1012000, ncb: 0, why: 'Agreed to renew · payment link opened, not paid', nextMin: -35, quotes: [['Cholamandalam', 24900, 'live', 45], ['SBI General', 25600, 'manual']], calls: [[75, 'me', true, 'agreed', 'Agreed to renew · payment link sent'], [1500, 'me', true, 'deciding', 'Heard quote · will confirm']] },
  { name: 'Sunita Rao', mobile: '9849133207', lang: 'English', model: 'Venue SX', reg: 'TS10 GA 7781', source: 'own_renewal', status: 'not_connected', expIn: -4, insurer: 'Tata AIG', type: 'OD+TP', premium: 19800, idv: 801000, ncb: 50, by: 'Anitha', byYear: 1, why: 'Expired 4 days ago · no cover now · inspection needed', nextMin: -120, quotes: [['Cholamandalam', 20400, 'live']], calls: [[100, 'me', false, 'no_answer', ''], [1300, 'me', false, 'no_answer', '']] },
  { name: 'Ramesh Kumar', mobile: '9848077120', lang: 'Telugu', model: 'Creta SX Diesel', reg: 'TS09 EX 4521', source: 'own_renewal', status: 'not_connected', expIn: 6, insurer: 'ICICI Lombard', type: 'OD+TP', premium: 18100, idv: 910000, ncb: 35, by: 'Anitha', byYear: 1, why: 'Ends in 6 days · answers after 3 pm', nextMin: 120, quotes: [['Cholamandalam', 18450, 'live', 40], ['ICICI Lombard', 18920, 'manual']], calls: [[90, 'ai', false, 'no_answer', ''], [1500, 'ai', false, 'no_answer', ''], [4300, 'ai', false, 'no_answer', '']] },
  { name: 'Suresh Babu', mobile: '9701099834', lang: 'Telugu', model: 'Tucson', reg: 'TS09 SB 1010', source: 'own_renewal', status: 'hot', expIn: 7, insurer: 'HDFC ERGO', type: 'OD+TP', premium: 38200, idv: 2190000, ncb: 50, by: 'Anitha', byYear: 1, why: 'Agreed · said he will pay today', nextMin: 150, quotes: [['Cholamandalam', 38900, 'live', 60], ['HDFC ERGO', 39700, 'manual']], calls: [[50, 'me', true, 'agreed', 'Agreed · will pay today'], [1400, 'me', true, 'deciding', 'Heard quote · asked for 5% off']] },
  { name: 'Arjun Reddy', mobile: '9849200418', lang: 'Telugu', model: 'i20 Asta', reg: 'TS07 HK 2210', source: 'winback', status: 'callback', expIn: 21, insurer: 'Acko', type: 'OD+TP', premium: 16900, idv: 590000, ncb: 25, why: 'Renewed online last year · price is his main concern', nextMin: -3 * 1440, promised: true, calls: [[200, 'ai', false, 'no_answer', ''], [4 * 1440, 'me', true, 'call_later', 'Picked up · asked for a call the next day']] },
  { name: 'Kavya Nair', mobile: '9848155073', lang: 'Malayalam', model: 'Exter SX', reg: 'TS09 FB 3301', source: 'own_renewal', status: 'not_connected', expIn: 28, insurer: 'Cholamandalam', type: 'OD only', premium: 9600, idv: 710000, ncb: 0, by: 'Anitha', byYear: 1, first: true, why: 'AI reached her · wants to renew · own damage only', nextMin: 190, aiQ: 8, quotes: [['Cholamandalam', 9850, 'live', 40], ['Reliance General', 10120, 'manual'], ['HDFC ERGO', null, 'manual']], calls: [[8, 'ai', true, 'agreed', 'Interested · wants to renew'], [60, 'me', false, 'no_answer', ''], [1470, 'me', false, 'no_answer', '']] },
  { name: 'Venkat Swamy', mobile: '9701066102', lang: 'Telugu', model: 'Creta EX', reg: 'TS11 MK 4410', source: 'renewal_from_sales', status: 'follow_up', expIn: 23, insurer: 'ICICI Lombard', type: 'OD+TP', premium: 19100, idv: 880000, ncb: 20, why: 'Heard the quote · comparing with another dealer', nextMin: -5 * 1440, quotes: [['Cholamandalam', 19400, 'live']], calls: [[240, 'ai', false, 'no_answer', ''], [5 * 1440 + 200, 'me', true, 'deciding', 'Heard quote · comparing with another dealer']] },
  { name: 'Fatima Begum', mobile: '9849311765', lang: 'Hindi', model: 'Venue', reg: 'TS13 FB 5521', source: 'renewal_from_service', status: 'callback', expIn: 19, insurer: 'New India', type: 'OD+TP', premium: 15200, idv: 640000, ncb: 20, by: 'Anitha', byYear: 1, why: 'Was driving · asked for a call later today', nextMin: 230, promised: true, calls: [[20, 'me', true, 'call_later', 'Picked up · asked for a call later']] },
  { name: 'Rahul Verma', mobile: '9848290356', lang: 'Hindi', model: 'Creta Electric', reg: 'TS09 RV 7720', ev: true, source: 'own_renewal', status: 'follow_up', expIn: 14, insurer: 'Bajaj Allianz', type: 'OD+TP', premium: 30800, idv: 1780000, ncb: 45, by: 'Meghana', byYear: 1, why: 'Heard the quote · discussing with family', nextMin: 1200, quotes: [['Cholamandalam', 31400, 'live']], calls: [[1260, 'me', true, 'deciding', 'Heard quote · discussing with family'], [8600, 'me', false, 'no_answer', '']] },
  { name: 'Lakshmi Devi', mobile: '9701120987', lang: 'Telugu', model: 'Grand i10', reg: 'TS12 LD 0921', source: 'own_lost', status: 'not_contacted', expIn: 25, insurer: 'Digit', type: 'OD+TP', premium: 8700, idv: 310000, ncb: 0, by: 'Kiran', byYear: 2, why: 'Insured with us two years ago · lost twice since', nextMin: 1300, dnc: true },
  { name: 'Anjali Gupta', mobile: '9849405512', lang: 'Hindi', model: 'Aura', reg: 'TS05 AG 3381', source: 'other_data', status: 'not_contacted', expIn: 31, insurer: 'Not known', type: 'OD+TP', premium: null, idv: null, ncb: null, why: 'No earlier policy found · ask the insurer and end date', nextMin: 1380 },
];

const FIRST = ['Aditya', 'Bhavana', 'Chaitanya', 'Deepika', 'Farhan', 'Gayatri', 'Harish', 'Indira', 'Jagadish', 'Keerthi', 'Lokesh', 'Manasa', 'Naveen', 'Pallavi', 'Rajesh', 'Swathi', 'Tarun', 'Uma', 'Vamsi', 'Yamini'];
const LAST = ['Reddy', 'Rao', 'Naidu', 'Sharma', 'Khan', 'Iyer', 'Goud', 'Varma', 'Patel', 'Das'];
const MODELS = ['i20 Sportz', 'Venue S', 'Creta E', 'Aura SX', 'Verna S', 'Exter S', 'Grand i10 Nios'];
const INSURERS = ['Cholamandalam', 'ICICI Lombard', 'HDFC ERGO', 'Tata AIG', 'Bajaj Allianz'];

export function buildSeed(now: Date): Omit<Db, 'version'> {
  const tz = 'Asia/Kolkata';
  const today = dateIn(tz, now);
  const year = Number(today.slice(0, 4));
  const dealer = { id: 'dealer-1', name: 'Kukatpally Hyundai', timezone: tz, callStartHour: 8, callEndHour: 18, aiPickupDays: 2, ruleRenewerFirst: true };
  const mkUser = (id: string, name: string, mobile: string, pin: string, role: MockUser['role'], status: MockUser['status'], reportsTo: string | null): MockUser => ({ id, dealerId: dealer.id, branch: 'Kukatpally', name, mobile, pin, role, status, reportsTo });
  const users: MockUser[] = [
    mkUser('u-anitha', 'Anitha', '9000000001', '1111', 'telecaller', 'active', 'u-ravi'),
    mkUser('u-harsha', 'Harsha', '9000000002', '2222', 'telecaller', 'active', 'u-ravi'),
    mkUser('u-meghana', 'Meghana', '9000000003', '3333', 'telecaller', 'active', 'u-ravi'),
    mkUser('u-kiran', 'Kiran', '9000000009', '9999', 'telecaller', 'left', 'u-ravi'),
    mkUser('u-ravi', 'Ravi', '9000000004', '4444', 'team_lead', 'active', 'u-vikram'),
    mkUser('u-vikram', 'Vikram', '9000000005', '5555', 'admin', 'active', null),
  ];
  const uid = (name: string) => users.find((u) => u.name === name)!.id;
  const db: Omit<Db, 'version'> = { dealer, users, customers: [], vehicles: [], policies: [], leads: [], quotes: [], calls: [], messages: [], reveals: [], targets: {}, rrCursor: 0, settings: { ignoreCallingHours: false } };
  users.filter((u) => u.role === 'telecaller').forEach((u) => (db.targets[u.id] = { policiesPerMonth: 112, callsPerDay: 120 }));
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;
  const iso = (minsFromNow: number) => new Date(now.getTime() + minsFromNow * MIN).toISOString();

  const addLead = (s: SeedLead, forceOwner?: string, closedDaysAgo?: number) => {
    const customer: Customer = { id: id('cust'), name: s.name, mobile: s.mobile, altMobile: null, email: s.name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com', language: s.lang, address: null, doNotCall: !!s.dnc, doNotMessage: false, wrongNumber: false };
    const vehicle: Vehicle = { id: id('veh'), customerId: customer.id, model: s.model, regNo: s.reg, chassisNo: 'MALC381CRPM' + String(100000 + n * 7919).slice(-6), engineNo: (s.ev ? 'MT' : 'G4LC') + String(700000 + n * 3571).slice(-6) + (s.ev ? 'E' : ''), isElectric: !!s.ev };
    const exp = addDays(today, s.expIn);
    const prev: Policy = { id: id('pol'), vehicleId: vehicle.id, insurer: s.insurer, policyNo: s.insurer === 'Not known' ? null : String(10110000000000 + n * 104729), policyType: s.type, odStart: addDays(exp, -364), odEnd: exp, tpStart: addDays(exp, -364), tpEnd: exp, premium: s.premium, idv: s.idv, ncbPercent: s.ncb, issuedBy: s.by ? uid(s.by) : null, issuedOn: s.by ? `${year - (s.byYear ?? 1)}-${today.slice(5)}` : null, isRenewal: !s.first };
    const al = forceOwner ? { ownerId: forceOwner, why: 'round_robin' as const, nextCursor: db.rrCursor } : allocateLead(prev, users, dealer, db.rrCursor);
    db.rrCursor = al.nextCursor;
    const closed = closedDaysAgo != null;
    const lead: Lead = { id: id('lead'), dealerId: dealer.id, customerId: customer.id, vehicleId: vehicle.id, prevPolicyId: prev.id, source: s.source, status: s.status, expiryDate: exp, ownerId: al.ownerId, allottedOn: addDays(today, -Math.max(1, 45 - s.expIn)), allottedWhy: al.why, whyNow: s.why, nextCallAt: s.nextMin == null ? null : iso(s.nextMin), callbackPromised: !!s.promised, lostReason: null, aiQualifiedAt: s.aiQ != null ? iso(-s.aiQ) : null, closedAt: closed ? new Date(now.getTime() - closedDaysAgo! * DAYMS).toISOString() : null };
    db.customers.push(customer); db.vehicles.push(vehicle); db.policies.push(prev); db.leads.push(lead);
    (s.quotes ?? []).forEach(([insurer, premium, kind, valid]) => {
      const q: Quote = { id: id('quote'), leadId: lead.id, insurer, kind, premium, idv: s.idv, ncbPercent: s.ncb == null ? null : Math.min(50, s.ncb + (s.ncb === 0 ? 20 : s.ncb < 50 ? 10 : 0)), addons: premium ? 'Zero dep, RSA' : null, paymentLink: valid ? 'https://pay.example.com/' + lead.id : null, linkExpiresAt: valid ? iso(valid) : null, createdBy: al.ownerId, createdAt: iso(-90) };
      db.quotes.push(q);
    });
    (s.calls ?? []).forEach(([ago, by, connected, outcome, note]) => {
      const c: Call = { id: id('call'), leadId: lead.id, madeBy: by === 'ai' ? 'ai' : 'caller', userId: by === 'ai' ? null : al.ownerId, startedAt: iso(-ago), endedAt: iso(-ago + 3), connected, durationSec: connected ? 95 + ((n * 37) % 190) : 0, outcome, reason: null, note: note || null, manual: false };
      db.calls.push(c);
    });
    return lead;
  };

  LEADS.forEach((s) => addLead(s));

  // Policies already renewed this month, so targets and search have something real behind them.
  const dayOfMonth = Number(today.slice(8));
  const done: [string, number][] = [['Anitha', 38], ['Harsha', 29], ['Meghana', 33]];
  done.forEach(([name, count]) => {
    for (let i = 0; i < count; i++) {
      const k = n + i;
      addLead({ name: `${FIRST[k % FIRST.length]} ${LAST[(k * 3) % LAST.length]}`, mobile: String(9100000000 + k * 7717), lang: 'Telugu', model: MODELS[k % MODELS.length], reg: `TS${String(7 + (k % 6)).padStart(2, '0')} ${'ABCDEFGH'[k % 8]}${'KLMNPQRS'[(k * 5) % 8]} ${String(1000 + ((k * 613) % 9000))}`, source: 'own_renewal', status: 'renewed', expIn: (k % 20) - 5, insurer: INSURERS[k % INSURERS.length], type: 'OD+TP', premium: 12000 + ((k * 977) % 22000), idv: 500000 + ((k * 7919) % 900000), ncb: [0, 20, 25, 35, 45, 50][k % 6], by: name, byYear: 1, why: 'Renewed', nextMin: null }, uid(name), i % Math.max(1, dayOfMonth));
    }
  });
  return db;
}
