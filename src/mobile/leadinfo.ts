// One row per board lead with the facts admin tools filter on: previous insurer, renewal year,
// source and current owner. Read on the side as the team lead (who sees every lead); cached until
// ownership or staffing changes.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MobileCtx } from './logic';
import { plain } from './profile';

export interface LeadRow { k: number; name: string; ins: string; ren: string; src: string; owner: string }
const DEPS = ['own', 'emp', 'rules'];
const EMPTY_F = { preset: null, expMax: 30, months: [], ai: [], src: [], model: [], ins: [], ptype: [], status: [], nxt: [], ren: [], lang: [], kyc: [] };

export function leadRows(ctx: MobileCtx): LeadRow[] {
  const self: any = ctx.self;
  const memo = self.__mLeadRows || (self.__mLeadRows = { deps: null, rows: [] });
  const now = DEPS.map((k) => self.state[k]);
  if (memo.deps && memo.deps.every((d: any, i: number) => d === now[i])) return memo.rows;
  const saved = self.state, rows: LeadRow[] = [];
  try {
    self.state = { ...saved, me: 'ravi', tab: 'all', f: EMPTY_F, open: false };
    const cards: Record<string, any> = {};
    (ctx.fresh().groups || []).forEach((g: any) => (g.cards || []).forEach((c: any) => { cards[plain(c.name)] = c; }));
    for (let k = 0; k < 40; k++) {
      self.state = { ...saved, me: 'ravi', sel: k, open: true };
      const v = ctx.fresh();
      if (!v.sel || !v.sel.name) break;
      const name = plain(v.sel.name), c = cards[name] || {};
      const parts = String(c.srcLine || '').split(/\s*·\s*/);
      const ins = v.pp && v.pp.ins && v.pp.ins !== 'Not known' ? String(v.pp.ins) : '';
      const owner = String(((v.flags || [])[0] || {}).label || '').replace(/^Owner: /, '');
      rows.push({ k, name, ins, ren: parts[1] || '', src: parts[0] || '', owner });
    }
  } catch { /* keep what we have */ } finally { self.state = saved; }
  memo.deps = now; memo.rows = rows;
  return rows;
}

export const yearOf = (ren: string) => { const m = /^(\d+)/.exec(ren || ''); return m ? +m[1] : 0; };
