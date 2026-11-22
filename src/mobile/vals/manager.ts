import type { MobileCtx } from '../logic';

/** Manager tools from dealer feedback (m.mgr.*): coupons and discounts by caller, and a month-wise
 *  data check of leads against last year. SAMPLE FIGURES until the backend reports them. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const LIMIT = 5; // discount allowed on a quote, in percent (as on the quote's discount box)
const COUPONS = [
  { who: 'Anitha', n: 18, value: 14500, avg: 2.4, max: 5, over: 0 },
  { who: 'Harsha', n: 25, value: 21000, avg: 3.9, max: 7, over: 3 },
  { who: 'Meghana', n: 12, value: 9000, avg: 1.8, max: 4, over: 0 },
];
const MONTHS = ['Oct 2026', 'Nov 2026', 'Dec 2026'];
// per month: expected from last year, uploaded to the CRM, allotted to callers
const CHECK: Record<string, { cat: string; why: string; exp: number; up: number; allot: number }[]> = {
  'Oct 2026': [
    { cat: 'Renewals due', why: 'Policies we renewed or sold in Oct 2025', exp: 388, up: 388, allot: 388 },
    { cat: 'First renewals', why: 'Cars we sold in Oct 2025', exp: 142, up: 142, allot: 141 },
    { cat: 'Lost last year (winback)', why: 'Lost to others in Oct 2025', exp: 61, up: 61, allot: 61 },
  ],
  'Nov 2026': [
    { cat: 'Renewals due', why: 'Policies we renewed or sold in Nov 2025', exp: 412, up: 398, allot: 396 },
    { cat: 'First renewals', why: 'Cars we sold in Nov 2025', exp: 136, up: 121, allot: 121 },
    { cat: 'Lost last year (winback)', why: 'Lost to others in Nov 2025', exp: 58, up: 58, allot: 55 },
  ],
  'Dec 2026': [
    { cat: 'Renewals due', why: 'Policies we renewed or sold in Dec 2025', exp: 455, up: 0, allot: 0 },
    { cat: 'First renewals', why: 'Cars we sold in Dec 2025', exp: 171, up: 0, allot: 0 },
    { cat: 'Lost last year (winback)', why: 'Lost to others in Dec 2025', exp: 66, up: 0, allot: 0 },
  ],
};
const nf = (n: number) => n.toLocaleString('en-IN');

export default function (v: any, ctx: MobileCtx): any {
  const s = ctx.self.state;
  const isTeam = !!(v.adm && v.adm.navShow && v.adm.navShow !== 'none');

  // ---- coupons and discounts by caller
  const coupons = COUPONS.map((c) => ({
    who: c.who, n: String(c.n), value: '₹' + nf(c.value), avg: c.avg.toFixed(1) + '%', max: c.max + '%',
    over: c.over ? c.over + (c.over === 1 ? ' quote' : ' quotes') + ' over ' + LIMIT + '%' : 'None over ' + LIMIT + '%', overBad: c.over > 0,
  }));

  // ---- data check, month by month
  const month: string = MONTHS.indexOf(s.mDcMonth) >= 0 ? s.mDcMonth : 'Nov 2026';
  const rows = (CHECK[month] || []).map((r) => {
    const missing = Math.max(0, r.exp - r.up), unalloc = Math.max(0, r.up - r.allot);
    const notYet = r.up === 0;
    return {
      cat: r.cat, why: r.why, exp: nf(r.exp), up: notYet ? '—' : nf(r.up), allot: notYet ? '—' : nf(r.allot),
      status: notYet ? 'Not uploaded yet' : missing ? nf(missing) + ' missing from upload' : unalloc ? nf(unalloc) + ' not given to a caller' : 'Matches',
      cls: notYet ? '-orange' : missing ? '-red' : unalloc ? '-orange' : '-green',
    };
  });
  const tot = (CHECK[month] || []).reduce((a, r) => ({ exp: a.exp + r.exp, up: a.up + r.up, allot: a.allot + r.allot }), { exp: 0, up: 0, allot: 0 });
  const miss = tot.up ? tot.exp - tot.up : 0, un = tot.up - tot.allot;
  const sent = !!((s.mDcSent || {})[month]);
  const open = s.mSheet === 'datacheck';

  return {
    isTeam,
    coupons, limit: LIMIT + '%',
    dc: {
      open, start: () => ctx.set({ mSheet: 'datacheck' }), close: () => ctx.set({ mSheet: null }),
      months: MONTHS.map((m) => ({ label: m, on: m === month ? 'true' : 'false', pick: () => ctx.set({ mDcMonth: m }) })),
      month, rows,
      summary: !tot.up ? 'Leads for ' + month + ' are not uploaded yet. Expected ' + nf(tot.exp) + ' from last year.'
        : miss || un ? nf(miss) + ' leads missing from the upload' + (un ? ' and ' + nf(un) + ' not given to a caller' : '') + '.' : 'Every lead from last year is uploaded and with a caller.',
      summaryCls: !tot.up ? '-warn' : miss || un ? '-bad' : '-good',
      canAsk: !!tot.up && (miss > 0 || un > 0) && !sent, sent,
      ask: () => { const all = { ...(s.mDcSent || {}) }; all[month] = true; ctx.set({ mDcSent: all, mToast: 'Sent to the operations team with the ' + month + ' numbers.' }); },
    },
    layers: [{ id: 'datacheck', open, close: () => ctx.set({ mSheet: null }) }],
  };
}
