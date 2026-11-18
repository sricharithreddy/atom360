import type { MobileCtx } from '../logic';

/** Phone-only values for the Stats screen (m.stats.*). Nothing here changes a number: it only regroups
 *  what the board computed (pairs table headers with their cells) and keeps a few open/closed flags. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const DAYS_SHORT = 7;
// The board writes "1 leads"; say "1 lead".
const lead1 = (t: any) => String(t || '').replace(/^1 leads\b/, '1 lead');
const one = (n: any, single: string, many: string) => String(n) + ' ' + (String(n) === '1' ? single : many);

// The board signals "against target" by colour only; give it words too.
const PACE: Record<string, { text: string; cls: string }> = {
  '#166534': { text: 'On target', cls: '-green' },
  '#9A3412': { text: 'Slightly behind', cls: '-orange' },
  '#A3134F': { text: 'Behind target', cls: '-magenta' },
};

export default function (v: any, ctx: MobileCtx): any {
  const st = v.st || {};
  const s = ctx.self.state || {};
  const list = (x: any): any[] => (Array.isArray(x) ? x : []);
  /** Table header + positional cell -> one object per value. */
  const zip = (cols: any, cells: any) => list(cells).map((c: any, i: number) => ({ ...c, k: (list(cols)[i] || {}).t || '' }));

  const isBoard = ctx.shown(st.boardShow);

  // ---- filters ----
  const filters = list(st.filters).map((f: any) => {
    const cur = list(f.opts).find((o: any) => o.on);
    const active = !!cur && cur.val !== 'all';
    return { ...f, mid: 'm' + f.id, active, cls: active ? '-on' : '', cur: cur ? cur.label : '' };
  });
  const act = filters.filter((f: any) => f.active);
  const fOpen = !!s.mStatsF;

  // ---- overview ----
  const tiles = list(st.oTiles).map((t: any) => {
    const hasBar = ctx.shown(t.barShow);
    const pace = hasBar ? PACE[t.sFg] : null;
    return { ...t, hasBar, hasOf: !!t.of, hasPace: !!pace, pace: pace ? pace.text : '', paceCls: pace ? pace.cls : '' };
  });

  // ---- leads: breakdown ----
  const group = (r: any, total: boolean) => {
    const pairs = zip(st.cols, r && r.cells);
    return { label: (r && r.label) || '', head: pairs[0] || { k: '', n: '', p: '' }, rest: pairs.slice(1), cls: total ? '-total' : '' };
  };
  const cohortEmpty = ctx.shown(st.emptyShow);
  const groups = cohortEmpty ? [] : [group(st.total, true)].concat(list(st.rows).map((r: any) => group(r, false)));

  // ---- calling ----
  const hours = list(st.hours).map((h: any) => {
    const lab = String(h.label || '').split(' ');
    const cut = String(h.title || '').indexOf(': ');
    return { ...h, n: lab[0] || '', ap: lab[1] || '', best: h.fw === 700, cls: h.fw === 700 ? '-best' : '', counts: cut >= 0 ? String(h.title).slice(cut + 2) : String(h.title || '') };
  });
  const allDays = list(st.dayRows).map((d: any) => ({
    ...d, calls: one(d.calls, 'call', 'calls'),
    line: d.conn + ' connected (' + d.rate + ') · ' + d.talk + ' talk · ' + one(d.iss, 'policy', 'policies'),
  }));
  const daysAll = !!s.mStatsDays;
  const days = daysAll ? allDays : allDays.slice(0, DAYS_SHORT);
  const callers = list(st.pRows).map((r: any) => {
    const pairs = zip(st.pCols, r.cells);
    return { name: r.name, sub: lead1(r.sub), head: pairs[0] || { k: '', v: '' }, rest: pairs.slice(1), cls: r.fw === 700 ? '-total' : '' };
  });

  // ---- leaderboard ----
  const lbOpen = s.mStatsLb || '';
  const rank = (r: any) => {
    const open = lbOpen === r.name;
    return {
      ...r, pairs: zip(st.lbCols, r.cells).map((p: any) => ({ ...p, cls: p.fw === 700 ? '-on' : '' })),
      mine: r.bg !== 'transparent', cls: (r.bg !== 'transparent' ? '-mine ' : '') + (open ? '-open' : ''),
      hasMove: !!r.move, open, openStr: open ? 'true' : 'false',
      toggle: () => ctx.set({ mStatsLb: open ? '' : r.name }),
    };
  };
  const scope = list(st.lbScopeOpts).map((o: any) => ({
    ...o, press: o.on ? 'true' : 'false',
    pick: () => { if (typeof st.onLbScope === 'function') st.onLbScope({ target: { value: o.val } }); },
  }));

  return {
    isBoard, notBoard: !isBoard,
    custom: ctx.shown(st.customShow),
    // filters
    filters, fOpen, fOpenStr: fOpen ? 'true' : 'false', fCls: fOpen ? '-open' : '',
    fToggle: () => ctx.set({ mStatsF: !fOpen }),
    fCount: act.length, fAny: act.length > 0,
    fSummary: act.map((f: any) => f.cur).join(' · '),
    // overview
    tiles,
    lostEmpty: ctx.shown(st.lostEmptyShow), lostNote: lead1(st.lostNote),
    // leads
    cohortEmpty, groups,
    // calling
    hours, hoursOpen: !!s.mStatsHrs, hoursOpenStr: s.mStatsHrs ? 'true' : 'false',
    hoursToggle: () => ctx.set({ mStatsHrs: !s.mStatsHrs }),
    hoursText: s.mStatsHrs ? 'Hide the numbers' : 'Show the numbers for each hour',
    days, daysMore: allDays.length > DAYS_SHORT,
    daysText: daysAll ? 'Show the latest ' + DAYS_SHORT + ' days only' : 'Show all ' + allDays.length + ' days',
    daysToggle: () => ctx.set({ mStatsDays: !daysAll }),
    callers,
    // leaderboard
    hasLbNote: !!st.lbNote,
    scope, top: list(st.lbTop).map(rank), ranks: list(st.lbRows).map(rank),
  };
}
