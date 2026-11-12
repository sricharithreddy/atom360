// The fake server. Same endpoints, same rules and same answers the real backend will give (see docs/API.md).
import { delay, http, HttpResponse } from 'msw';
import type { Call, HistoryItem, Lead, LeadCard, LeadDetail, OutcomeInput, QueueResponse, Quote, QuoteInput, Session, TodaySummary, User } from '../domain/types';
import { aiState, canEditLead, isManager, isOpen, permissionsFor, queueGroup, queueRank, renewedBeforeSentence } from '../rules/leadRules';
import { dateIn, daysBetween } from '../rules/time';
import { getDb, newId, resetDb, save, type Db, type MockUser } from './store';

const API = '/api';
const fail = (status: number, message: string) => HttpResponse.json({ message }, { status });
const publicUser = ({ pin: _pin, ...u }: MockUser): User => u;
const mask = (v: string) => (v.length <= 5 ? v : v.slice(0, 2) + '•'.repeat(v.length - 5) + v.slice(-3));
const maskEmail = (v: string) => { const [a, b] = v.split('@'); return (a.length <= 2 ? a : a.slice(0, 2) + '•'.repeat(Math.max(1, a.length - 2))) + '@' + b; };

function auth(request: Request): MockUser | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  return getDb().users.find((u) => 'mock-' + u.id === token && u.status !== 'left') ?? null;
}

/** The dealer as the rules should see it right now (the sample-data switch can lift calling hours). */
function dealerNow(db: Db) {
  return db.settings.ignoreCallingHours ? { ...db.dealer, callStartHour: 0, callEndHour: 24 } : db.dealer;
}

function cardOf(db: Db, lead: Lead, me: MockUser, now: Date): LeadCard {
  const customer = db.customers.find((c) => c.id === lead.customerId)!;
  const vehicle = db.vehicles.find((v) => v.id === lead.vehicleId)!;
  const owner = db.users.find((u) => u.id === lead.ownerId)!;
  const dealer = dealerNow(db);
  const calls = db.calls.filter((c) => c.leadId === lead.id);
  const priced = db.quotes.filter((q) => q.leadId === lead.id && q.premium != null).sort((a, b) => a.premium! - b.premium!);
  return {
    id: lead.id, customerName: customer.name, model: vehicle.model, regNo: vehicle.regNo, source: lead.source, status: lead.status,
    expiryDate: lead.expiryDate, daysToExpiry: daysBetween(dateIn(dealer.timezone, now), lead.expiryDate), whyNow: lead.whyNow,
    nextCallAt: lead.nextCallAt, callbackPromised: lead.callbackPromised, ownerId: owner.id, ownerName: owner.name, isMine: owner.id === me.id,
    ai: isOpen(lead) ? aiState(lead, customer, dealer, now) : { kind: 'none' },
    bestQuote: priced[0] ? { insurer: priced[0].insurer, premium: priced[0].premium! } : null,
    attempts: { caller: calls.filter((c) => c.madeBy === 'caller').length, ai: calls.filter((c) => c.madeBy === 'ai').length },
    group: queueGroup(lead, dealer, now),
    permissions: permissionsFor(me, lead, customer, dealer, owner.name, now),
  };
}

function detailOf(db: Db, lead: Lead, me: MockUser, now: Date): LeadDetail {
  const customer = db.customers.find((c) => c.id === lead.customerId)!;
  const vehicle = db.vehicles.find((v) => v.id === lead.vehicleId)!;
  const prev = db.policies.find((p) => p.id === lead.prevPolicyId) ?? null;
  const owner = db.users.find((u) => u.id === lead.ownerId)!;
  const nameOf = (id: string | null) => (id === me.id ? 'You' : db.users.find((u) => u.id === id)?.name ?? 'Someone');
  const OUT: Record<string, string> = { agreed: 'Agreed to renew', deciding: 'Still deciding', call_later: 'Call back later', closed: 'Lead closed', no_answer: 'Not answered', switched_off: 'Switched off', busy: 'Busy' };
  const history: HistoryItem[] = [
    ...db.calls.filter((c) => c.leadId === lead.id).map((c): HistoryItem => ({
      id: c.id, kind: 'call', at: c.startedAt, by: c.madeBy === 'ai' ? 'AI' : nameOf(c.userId),
      text: c.outcome ? [OUT[c.outcome], c.reason, c.note].filter(Boolean).join(' · ') : 'Call made · outcome not logged',
      meta: c.manual ? 'Manual entry' : c.madeBy === 'ai' ? 'AI call' : c.connected ? `${Math.floor((c.durationSec ?? 0) / 60)} min ${(c.durationSec ?? 0) % 60} s · recorded` : c.outcome ? 'No talk time' : 'Outcome pending',
    })),
    ...db.messages.filter((m) => m.leadId === lead.id).map((m): HistoryItem => ({ id: m.id, kind: 'message', at: m.sentAt, by: nameOf(m.sentBy), text: `WhatsApp opened · ${m.template}`, meta: 'Message' })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const openCall = db.calls.filter((c) => c.leadId === lead.id && c.userId === me.id && c.outcome === null).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
  return {
    lead, card: cardOf(db, lead, me, now),
    customer: { name: customer.name, language: customer.language, address: customer.address, mobileMasked: mask(customer.mobile), emailMasked: customer.email ? maskEmail(customer.email) : null, doNotCall: customer.doNotCall },
    vehicle, prevPolicy: prev,
    renewedBefore: lead.allottedWhy === 'moved' ? `Moved to ${owner.name} by a team lead or admin.` : renewedBeforeSentence(prev, !!prev && !prev.isRenewal, db.users, me, owner.name),
    quotes: db.quotes.filter((q) => q.leadId === lead.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    history, openCall,
  };
}

const visibleTo = (me: MockUser) => (l: Lead) => isManager(me) || l.ownerId === me.id;

export const handlers = [
  http.post(`${API}/auth/sign-in`, async ({ request }) => {
    await delay(150);
    const { mobile, pin } = (await request.json()) as { mobile: string; pin: string };
    const db = getDb();
    const user = db.users.find((u) => u.mobile === String(mobile).replace(/\D/g, '').slice(-10) && u.pin === pin);
    if (!user) return fail(401, 'That mobile number and PIN do not match. Check both and try again.');
    if (user.status === 'left') return fail(403, 'This account is closed. Ask your admin.');
    return HttpResponse.json<Session>({ token: 'mock-' + user.id, user: publicUser(user), dealer: db.dealer });
  }),

  http.get(`${API}/me`, ({ request }) => {
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    return HttpResponse.json<Session>({ token: 'mock-' + me.id, user: publicUser(me), dealer: getDb().dealer });
  }),

  http.get(`${API}/today/summary`, async ({ request }) => {
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), now = new Date(), tz = db.dealer.timezone, today = dateIn(tz, now), month = today.slice(0, 7);
    const scope = db.leads.filter(visibleTo(me)), ids = new Set(scope.map((l) => l.id));
    const callers = isManager(me) ? db.users.filter((u) => u.role === 'telecaller' && u.status !== 'left') : [me];
    const todays = db.calls.filter((c) => ids.has(c.leadId) && c.madeBy === 'caller' && dateIn(tz, new Date(c.startedAt)) === today);
    const closedOn = (l: Lead, d: string, len: number) => !!l.closedAt && dateIn(tz, new Date(l.closedAt)).slice(0, len) === d;
    return HttpResponse.json<TodaySummary>({
      callsToday: todays.length, callsTarget: callers.reduce((s, u) => s + (db.targets[u.id]?.callsPerDay ?? 0), 0), connectedToday: todays.filter((c) => c.connected).length,
      renewedToday: scope.filter((l) => l.status === 'renewed' && closedOn(l, today, 10)).length, lostToday: scope.filter((l) => l.status === 'lost' && closedOn(l, today, 10)).length,
      monthPolicies: scope.filter((l) => l.status === 'renewed' && closedOn(l, month, 7)).length, monthTarget: callers.reduce((s, u) => s + (db.targets[u.id]?.policiesPerMonth ?? 0), 0),
    });
  }),

  http.get(`${API}/queue`, async ({ request }) => {
    await delay(120);
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), now = new Date(), q = new URL(request.url).searchParams;
    const mine = db.leads.filter((l) => isOpen(l) && visibleTo(me)(l)).map((l) => ({ lead: l, card: cardOf(db, l, me, now) }));
    const isDue = (c: LeadCard) => c.group === 'call_now';
    const counts = { due: mine.filter((x) => isDue(x.card)).length, hot: mine.filter((x) => x.lead.status === 'hot').length, followUps: mine.filter((x) => x.lead.status === 'follow_up' || x.lead.status === 'callback').length, all: mine.length,
      aiQualified: mine.filter((x) => x.card.ai.kind === 'qualified').length, expiring7: mine.filter((x) => x.card.daysToExpiry >= 0 && x.card.daysToExpiry <= 7).length, ownRenewal: mine.filter((x) => x.lead.source === 'own_renewal').length };
    const tab = q.get('tab') ?? 'all', exp = q.get('expiringInDays'), src = q.get('source');
    const leads = mine
      .filter((x) => (tab === 'due' ? isDue(x.card) : tab === 'hot' ? x.lead.status === 'hot' : tab === 'followUps' ? x.lead.status === 'follow_up' || x.lead.status === 'callback' : true))
      .filter((x) => q.get('aiQualified') !== 'true' || x.card.ai.kind === 'qualified')
      .filter((x) => !exp || (x.card.daysToExpiry >= 0 && x.card.daysToExpiry <= Number(exp)))
      .filter((x) => !src || x.lead.source === src)
      .sort((a, b) => queueRank(a.lead, now) - queueRank(b.lead, now))
      .map((x) => x.card);
    return HttpResponse.json<QueueResponse>({ total: mine.length, counts, leads });
  }),

  http.get(`${API}/leads/search`, async ({ request }) => {
    await delay(100);
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), now = new Date(), raw = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase(), digits = raw.replace(/\D/g, ''), compact = raw.replace(/\s/g, '');
    if (raw.length < 2) return HttpResponse.json<LeadCard[]>([]);
    const hits = db.leads.filter((l) => {
      const c = db.customers.find((x) => x.id === l.customerId)!, v = db.vehicles.find((x) => x.id === l.vehicleId)!, p = db.policies.find((x) => x.id === l.prevPolicyId);
      return c.name.toLowerCase().includes(raw) || v.regNo.toLowerCase().replace(/\s/g, '').includes(compact) || (digits.length >= 4 && (c.mobile.includes(digits) || (p?.policyNo ?? '').includes(digits)));
    });
    return HttpResponse.json<LeadCard[]>(hits.slice(0, 8).map((l) => cardOf(db, l, me, now)));
  }),

  http.get(`${API}/leads/:id`, async ({ request, params }) => {
    await delay(100);
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), lead = db.leads.find((l) => l.id === params.id);
    if (!lead) return fail(404, 'This lead no longer exists.');
    return HttpResponse.json<LeadDetail>(detailOf(db, lead, me, new Date()));
  }),

  // Anyone signed in can see a number once they act on the lead; every look is recorded.
  http.post(`${API}/leads/:id/reveal`, async ({ request, params }) => {
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), lead = db.leads.find((l) => l.id === params.id);
    if (!lead) return fail(404, 'This lead no longer exists.');
    const { field } = (await request.json()) as { field: 'mobile' | 'email' };
    const customer = db.customers.find((c) => c.id === lead.customerId)!;
    db.reveals.push({ leadId: lead.id, userId: me.id, field, at: new Date().toISOString() });
    save();
    return HttpResponse.json({ value: field === 'mobile' ? customer.mobile : customer.email ?? '' });
  }),

  http.post(`${API}/leads/:id/calls`, async ({ request, params }) => {
    await delay(120);
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), now = new Date(), lead = db.leads.find((l) => l.id === params.id);
    if (!lead) return fail(404, 'This lead no longer exists.');
    const perms = cardOf(db, lead, me, now).permissions;
    if (perms.callBlock) return fail(403, perms.callBlock.reason);
    const call: Call = { id: newId(), leadId: lead.id, madeBy: 'caller', userId: me.id, startedAt: now.toISOString(), endedAt: null, connected: null, durationSec: null, outcome: null, reason: null, note: null, manual: false };
    db.calls.push(call);
    save();
    return HttpResponse.json({ call, mobile: db.customers.find((c) => c.id === lead.customerId)!.mobile });
  }),

  http.post(`${API}/leads/:id/outcomes`, async ({ request, params }) => {
    await delay(150);
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), now = new Date(), lead = db.leads.find((l) => l.id === params.id);
    if (!lead) return fail(404, 'This lead no longer exists.');
    if (!canEditLead(me, lead)) return fail(403, 'Only the owner or a team lead can log an outcome on this lead.');
    const input = (await request.json()) as OutcomeInput;
    const needsWhen = input.outcome !== 'closed';
    if (needsWhen && !input.nextCallAt) return fail(422, 'Pick when the next call should happen.');
    if (input.outcome === 'closed' && !input.reason) return fail(422, 'Pick why this lead is closing.');
    const existing = input.callId ? db.calls.find((c) => c.id === input.callId && c.leadId === lead.id) : undefined;
    const call: Call = existing ?? { id: newId(), leadId: lead.id, madeBy: 'caller', userId: me.id, startedAt: now.toISOString(), endedAt: null, connected: null, durationSec: null, outcome: null, reason: null, note: null, manual: true };
    Object.assign(call, { endedAt: now.toISOString(), connected: input.connected, durationSec: input.connected ? input.durationSec ?? 0 : 0, outcome: input.outcome, reason: input.reason || null, note: input.note || null });
    if (!existing) db.calls.push(call);
    const customer = db.customers.find((c) => c.id === lead.customerId)!;
    lead.aiQualifiedAt = null; // a human has taken it from here
    lead.nextCallAt = needsWhen ? input.nextCallAt : null;
    lead.callbackPromised = input.outcome === 'call_later';
    if (input.outcome === 'agreed') lead.status = 'hot';
    else if (input.outcome === 'deciding') lead.status = 'follow_up';
    else if (input.outcome === 'call_later') lead.status = 'callback';
    else if (input.outcome === 'closed') {
      lead.status = 'lost'; lead.lostReason = input.reason; lead.closedAt = now.toISOString();
      if (input.reason === 'Asked not to call') customer.doNotCall = true;
      if (input.reason === 'Wrong number') customer.wrongNumber = true;
    } else if (lead.status === 'not_contacted') lead.status = 'not_connected';
    save();
    return HttpResponse.json<LeadDetail>(detailOf(db, lead, me, now));
  }),

  http.post(`${API}/leads/:id/quotes`, async ({ request, params }) => {
    await delay(120);
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), now = new Date(), lead = db.leads.find((l) => l.id === params.id);
    if (!lead) return fail(404, 'This lead no longer exists.');
    if (!canEditLead(me, lead)) return fail(403, 'Only the owner or a team lead can add a quote to this lead.');
    const input = (await request.json()) as QuoteInput & { id?: string };
    if (!input.insurer?.trim()) return fail(422, 'Add the insurance company.');
    if (input.paymentLink && !/^https?:\/\/\S+$/.test(input.paymentLink)) return fail(422, 'The payment link should start with http:// or https://');
    const patch = { insurer: input.insurer.trim(), premium: input.premium, idv: input.idv, ncbPercent: input.ncbPercent, addons: input.addons, paymentLink: input.paymentLink || null, linkExpiresAt: input.paymentLink && input.linkValidMinutes ? new Date(now.getTime() + input.linkValidMinutes * 60_000).toISOString() : null };
    const old = input.id ? db.quotes.find((q) => q.id === input.id && q.leadId === lead.id) : undefined;
    if (old?.kind === 'live') return fail(422, 'A live quote comes from the insurer and cannot be changed here.');
    const quote: Quote = old ? Object.assign(old, patch) : { id: newId(), leadId: lead.id, kind: 'manual', createdBy: me.id, createdAt: now.toISOString(), ...patch };
    if (!old) db.quotes.push(quote);
    save();
    return HttpResponse.json<LeadDetail>(detailOf(db, lead, me, now));
  }),

  // Individual WhatsApp for now: the server builds the message and a wa.me link; the caller sends it from their own number.
  http.post(`${API}/leads/:id/messages`, async ({ request, params }) => {
    const me = auth(request);
    if (!me) return fail(401, 'Please sign in again.');
    const db = getDb(), now = new Date(), lead = db.leads.find((l) => l.id === params.id);
    if (!lead) return fail(404, 'This lead no longer exists.');
    const customer = db.customers.find((c) => c.id === lead.customerId)!, vehicle = db.vehicles.find((v) => v.id === lead.vehicleId)!;
    if (customer.doNotMessage || customer.wrongNumber) return fail(403, 'Messages to this customer are stopped.');
    const { template } = (await request.json()) as { template: 'reminder' | 'quote' };
    const best = db.quotes.filter((q) => q.leadId === lead.id && q.premium != null).sort((a, b) => a.premium! - b.premium!)[0];
    if (template === 'quote' && !best) return fail(422, 'Add a quote with a premium first.');
    const when = new Date(lead.expiryDate + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const body = template === 'quote'
      ? `Hi ${customer.name.split(' ')[0]}, here is the renewal quote for your ${vehicle.model}: ${best!.insurer}, ₹${best!.premium!.toLocaleString('en-IN')} incl. GST${best!.addons ? ', add-ons: ' + best!.addons : ''}. Reply to go ahead and I will send the payment link.`
      : `Hi ${customer.name.split(' ')[0]}, the insurance on your ${vehicle.model} (${vehicle.regNo}) ends on ${when}. I am ${me.name} from ${db.dealer.name}. Shall I send this year's renewal quote?`;
    db.messages.push({ id: newId(), leadId: lead.id, channel: 'whatsapp', template: template === 'quote' ? 'Quote' : 'Renewal reminder', body, sentBy: me.id, sentAt: now.toISOString(), status: 'opened' });
    save();
    return HttpResponse.json({ body, waUrl: `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(body)}` });
  }),

  // ---- sample-data controls (not part of the real API) ----
  http.get(`${API}/mock/settings`, () => HttpResponse.json({ ...getDb().settings, users: getDb().users.filter((u) => u.status !== 'left').map((u) => ({ name: u.name, role: u.role, mobile: u.mobile, pin: u.pin })) })),
  http.post(`${API}/mock/settings`, async ({ request }) => { const db = getDb(); Object.assign(db.settings, await request.json()); save(); return HttpResponse.json(db.settings); }),
  http.post(`${API}/mock/reset`, () => { resetDb(); return HttpResponse.json({ ok: true }); }),
];
