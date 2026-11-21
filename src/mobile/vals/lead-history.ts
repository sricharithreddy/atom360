import type { MobileCtx } from '../logic';

/** History tab (m.hist.*): calls and messages from the board, and visits to our workshop.
 *  Service visits are SAMPLE DATA kept here until the board (or the dealer system) provides them. */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface Visit { when: string; kind: string; km: string; amt: string; note: string; by: string; claim?: boolean }

const W = 'Kukatpally workshop';
// one list per sample lead, newest first
const SERVICE: Visit[][] = [
  [ // Priya Sharma: Venue + i20, came through service
    { when: '28 Oct 2026', kind: 'Periodic service · Venue', km: '30,140 km', amt: '₹7,820', note: 'Brake pads replaced', by: 'Naveen' },
    { when: '14 Jun 2026', kind: 'Periodic service · i20', km: '41,600 km', amt: '₹6,150', note: '', by: 'Naveen' },
    { when: '9 Feb 2026', kind: 'Accident repair · Venue', km: '24,980 km', amt: '₹42,300', note: 'Cashless claim with Bajaj Allianz · rear bumper', by: 'Naveen', claim: true },
  ],
  [{ when: '2 Sep 2026', kind: 'First free service', km: '1,020 km', amt: '₹0', note: 'Bought here in Jul 2026', by: 'Praveen' }],
  [
    { when: '18 Mar 2026', kind: 'Periodic service', km: '38,400 km', amt: '₹8,960', note: 'Battery replaced', by: 'Naveen' },
    { when: '21 Sep 2025', kind: 'Periodic service', km: '29,700 km', amt: '₹6,480', note: '', by: 'Naveen' },
  ],
  [
    { when: '12 Oct 2026', kind: 'Periodic service', km: '52,300 km', amt: '₹11,240', note: 'Clutch plate, 4 tyres advised', by: 'Naveen' },
    { when: '3 Apr 2026', kind: 'Running repair', km: '46,900 km', amt: '₹3,150', note: 'AC gas top-up', by: 'Imran' },
    { when: '16 Oct 2025', kind: 'Periodic service', km: '41,200 km', amt: '₹9,870', note: '', by: 'Naveen' },
  ],
  [{ when: '30 Aug 2026', kind: 'Periodic service', km: '18,600 km', amt: '₹12,400', note: '', by: 'Imran' }],
  [], // Arjun Reddy: winback, services elsewhere
  [
    { when: '7 Nov 2026', kind: 'Periodic service', km: '10,050 km', amt: '₹4,980', note: 'Asked about renewal at the desk', by: 'Naveen' },
    { when: '11 May 2026', kind: 'Accessories fitted', km: '5,400 km', amt: '₹8,500', note: 'Seat covers, mats', by: 'Praveen' },
  ],
  [{ when: '19 Jul 2026', kind: 'Periodic service', km: '22,800 km', amt: '₹7,260', note: '', by: 'Imran' }],
  [
    { when: '4 Nov 2026', kind: 'Periodic service', km: '33,700 km', amt: '₹8,110', note: 'Renewal lead raised from this visit', by: 'Naveen' },
    { when: '6 Jan 2026', kind: 'Accident repair', km: '27,300 km', amt: '₹18,900', note: 'Claim with New India · windshield', by: 'Naveen', claim: true },
  ],
  [{ when: '25 Sep 2026', kind: 'Periodic service', km: '14,200 km', amt: '₹2,900', note: 'EV check, software update', by: 'Imran' }],
  [{ when: '10 Dec 2024', kind: 'Periodic service', km: '61,000 km', amt: '₹5,700', note: 'Last visit to us', by: 'Naveen' }],
  [],
];

export default function (v: any, ctx: MobileCtx): any {
  const s = ctx.self.state;
  const seg: string = s.mHistSeg === 'svc' ? 'svc' : 'comm';
  const pick = (id: string) => () => ctx.set({ mHistSeg: id });

  const comm = (v.histRows || []).map((h: any) => {
    const t = String(h.t || '');
    const msg = /^(WhatsApp|Email|SMS)\b/.test(t) || /WhatsApp sent/.test(t);
    const ai = h.by === 'AI';
    return { when: h.when, by: h.by, t, meta: h.meta, kind: ai ? 'ai' : msg ? 'msg' : 'call', cls: ai ? '-ai' : msg ? '-msg' : '-call' };
  });
  const visits = (SERVICE[s.sel] || []).map((x) => ({ ...x, workshop: W, hasNote: !!x.note, cls: x.claim ? '-claim' : '' }));
  const spent = visits.reduce((n, x) => n + (parseInt(x.amt.replace(/[^0-9]/g, ''), 10) || 0), 0);

  return {
    segComm: seg === 'comm', segSvc: seg === 'svc',
    segs: [
      { id: 'comm', label: 'Calls & messages', n: comm.length, on: seg === 'comm' ? 'true' : 'false', pick: pick('comm') },
      { id: 'svc', label: 'Service', n: visits.length, on: seg === 'svc' ? 'true' : 'false', pick: pick('svc') },
    ],
    comm, hasComm: comm.length > 0,
    visits, hasVisits: visits.length > 0,
    svcSummary: visits.length ? visits.length + (visits.length === 1 ? ' visit' : ' visits') + (spent ? ' · ₹' + spent.toLocaleString('en-IN') + ' spent' : '') + (visits.some((x) => x.claim) ? ' · includes a claim repair' : '') : '',
  };
}
