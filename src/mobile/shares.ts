// Quote share log: how each quote reached the customer (card or text, WhatsApp or email), with the
// insurer and price. Kept on the phone until the backend stores it.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MobileCtx } from './logic';

export interface Share { kind: 'Quote card' | 'Text'; ch: 'WhatsApp' | 'Email'; insurer: string; amt: string; when: string; by: string }

export function selectedQuote(v: any): { insurer: string; amt: string } {
  const t = (v.qTabs || []).filter((x: any) => x.sel === 'true' || x.sel === true)[0] || {};
  return { insurer: String(t.name || ''), amt: /₹/.test(String(t.amt || '')) ? String(t.amt) : '' };
}

export function logShare(ctx: MobileCtx, v: any, kind: Share['kind'], ch: Share['ch']): void {
  const s = ctx.self.state, k = s.sel;
  const by = (/Signed in as ([^,]+)/.exec(String((v.me && v.me.label) || '')) || [])[1] || 'You';
  const q = selectedQuote(v);
  const all = { ...(s.mQshares || {}) };
  all[k] = [{ kind, ch, insurer: q.insurer, amt: q.amt, when: 'Today 1:10 pm', by }].concat(all[k] || []);
  ctx.set({ mQshares: all });
}
