// Lead stage (how far a renewal has got), used by the Stage filter on Today.
// The board works these facts out only for the open lead, so each lead is read once on the side
// and the result is kept until something that moves a stage changes (history, payment, inspection).
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MobileCtx } from './logic';

export const STAGES: { id: string; label: string }[] = [
  { id: 'new', label: 'Not contacted' },
  { id: 'spoke', label: 'Spoke to customer' },
  { id: 'quote', label: 'Quote shared' },
  { id: 'link', label: 'Payment link sent' },
  { id: 'paid', label: 'Paid' },
  { id: 'issued', label: 'Policy issued' },
  { id: 'insp', label: 'Inspection pending' },
];
const LABEL: Record<string, string> = {};
STAGES.forEach((st) => { LABEL[st.id] = st.label; });
export const stageLabel = (id: string) => LABEL[id] || '';

export const plainName = (n: any) => String(n || '').replace(/ \(\+1 car\)$/, '').replace(/ \+1 vehicle$/, '');
const DEPS = ['hadd', 'pay', 'insp', 'cs', 'aiq', 'qStore', 'msg'];

function stageFromVals(vals: any): string {
  const strips: any[] = vals.strips || [];
  const done = (sp: any, n: number) => !!(sp && sp.steps && sp.steps[n] && sp.steps[n].n === '✓');
  const pay = strips.filter((sp) => /PAYMENT/.test(sp.title || ''))[0];
  const lapsed = strips.filter((sp) => /LAPSED/.test(sp.title || ''))[0];
  if (pay) return done(pay, 2) ? 'issued' : done(pay, 1) ? 'paid' : 'link';
  if (lapsed && !done(lapsed, 2)) return 'insp';
  const stat = (k: string) => ((vals.pn && vals.pn.stats) || []).filter((x: any) => x.k === k)[0] || {};
  // the board counts a quote heard on a call; a quote sent on WhatsApp or email counts too
  const sentQuote = ((vals.histRows || []) as any[]).some((h) => /sent/i.test(h.t || '') && /quote/i.test(h.t || ''));
  if (/heard/.test(String(stat('Quotes').sub || '')) || sentQuote) return 'quote';
  if (stat('Last spoke').v && stat('Last spoke').v !== 'Never') return 'spoke';
  return 'new';
}

/** Stage of every lead, by customer name. */
export function stagesByName(ctx: MobileCtx): Record<string, string> {
  const self: any = ctx.self;
  const memo = self.__mStages || (self.__mStages = { deps: null, map: {} });
  const now = DEPS.map((k) => self.state[k]);
  if (memo.deps && memo.deps.every((d: any, i: number) => d === now[i])) return memo.map;
  const saved = self.state, map: Record<string, string> = {};
  try {
    for (let k = 0; k < 40; k++) {
      self.state = { ...saved, me: 'ravi', sel: k, open: true };
      const vals = ctx.fresh();
      if (!vals.sel || !vals.sel.name) break;
      map[plainName(vals.sel.name)] = stageFromVals(vals);
    }
  } catch { /* leave what we have */ } finally { self.state = saved; }
  memo.deps = now; memo.map = map;
  return map;
}

/** Today's groups with the Stage filter applied, the stage counts (before it), and how many show. */
export const QUICK: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'due7', label: 'Due 7 days' },
  { id: 'pay', label: 'Payment' },
  { id: 'quote', label: 'Quote sent' },
];
const daysOf = (c: any) => { const m = /(\d+)/.exec(String(c.daysLeft || '')); return m ? parseInt(m[1], 10) * (/expired/i.test(String(c.daysLeft || '')) ? -1 : 1) : 999; };
function quickOk(id: string, c: any, st: string): boolean {
  if (id === 'due7') return daysOf(c) <= 7; // expired ones are the most overdue, so they count
  if (id === 'pay') return st === 'link';
  if (id === 'quote') return st === 'quote';
  return true;
}

export function stageView(v: any, ctx: MobileCtx): { groups: any[]; shown: number; counts: Record<string, number>; picked: string[]; quick: string; quickCounts: Record<string, number> } {
  const self: any = ctx.self;
  const picked: string[] = self.state.mStage || [];
  const quick: string = self.state.mQuick || 'all';
  const cache = self.__mStageView;
  if (cache && cache.v === v && cache.picked === picked && cache.quick === quick) return cache.out;
  const map = stagesByName(ctx);
  const counts: Record<string, number> = {};
  const quickCounts: Record<string, number> = {};
  const groups = (v.groups || []).map((g: any) => {
    const cards = (g.cards || []).filter((c: any) => {
      const st = map[plainName(c.name)] || 'new';
      counts[st] = (counts[st] || 0) + 1;
      if (picked.length && picked.indexOf(st) < 0) return false;
      QUICK.forEach((q) => { if (quickOk(q.id, c, st)) quickCounts[q.id] = (quickCounts[q.id] || 0) + 1; });
      return quickOk(quick, c, st);
    });
    return { ...g, cards, count: cards.length === 1 ? '1 lead' : cards.length + ' leads' };
  }).filter((g: any) => g.cards.length > 0);
  const shown = groups.reduce((n: number, g: any) => n + g.cards.length, 0);
  const out = { groups, shown, counts, picked, quick, quickCounts };
  self.__mStageView = { v, picked, quick, out };
  return out;
}
