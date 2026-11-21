import type { MobileCtx } from '../logic';

/** Notifications (m.alerts.*): callback reminders and the other things that need the caller now.
 *  They are read from the whole queue, whatever tab or filter Today shows. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const SNOOZE_MS = 10 * 60 * 1000;
const EMPTY_F = { preset: null, expMax: 30, months: [], ai: [], src: [], model: [], ins: [], ptype: [], status: [], nxt: [], ren: [], lang: [], kyc: [] };
// state the alerts depend on; when none of these change, the last list is reused
const DEPS = ['me', 'cs', 'hadd', 'aiq', 'aiDone', 'snz', 'own', 'dnc', 'emp', 'rules', 'pay', 'insp'];

/** The queue as "All" with no filters, computed on the side (the screen's own tab and filters stay as they are). */
function wholeQueue(ctx: MobileCtx): any[] {
  const self: any = ctx.self;
  const memo = self.__mAlerts || (self.__mAlerts = { deps: null, cards: [] });
  const now = DEPS.map((k) => self.state[k]);
  if (memo.deps && memo.deps.every((d: any, i: number) => d === now[i])) return memo.cards;
  const saved = self.state;
  let cards: any[] = [];
  try {
    self.state = { ...saved, tab: 'all', f: EMPTY_F };
    const all = ctx.fresh();
    cards = (all.groups || []).reduce((acc: any[], g: any) => acc.concat((g.cards || []).map((c: any) => ({ ...c, group: g.title }))), []);
  } finally {
    self.state = saved;
  }
  memo.deps = now; memo.cards = cards;
  return cards;
}

export default function (v: any, ctx: MobileCtx): any {
  const self: any = ctx.self;
  const cb = v.cb || {};
  const on = ctx.shown;
  const open = (pick: () => void) => () => { if (self.state.view && self.state.view !== 'today') self.setState({ view: 'today' }); pick(); ctx.set({ mSheet: null, mTab: 'sum' }); };

  // 1. Promised callback that is due (the board tracks one: Priya Sharma, 1:00 pm)
  const dueShow = on(cb.homeShow) || on(cb.panelShow);
  const snoozed = on(cb.snoozedShow);
  const due = {
    show: dueShow, snoozed,
    title: String(cb.text || '').split(' · ')[0],
    sub: String(cb.text || '').split(' · ').slice(1).join(' · '),
    note: cb.sub || '',
    snoozeText: String(cb.snoozeText || '').replace(/\s*It comes back on its own\.?/, ''),
    call: () => { cb.callNow(); ctx.set({ mSheet: null, mTab: 'sum' }); },
    snooze: () => {
      cb.snooze();
      if (self.__mTodaySnz) clearTimeout(self.__mTodaySnz);
      self.__mTodaySnz = setTimeout(() => { self.__mTodaySnz = null; if (self.state.snz) ctx.fresh().cb.unsnooze(); }, SNOOZE_MS);
    },
    unsnooze: () => { if (self.__mTodaySnz) { clearTimeout(self.__mTodaySnz); self.__mTodaySnz = null; } cb.unsnooze(); },
  };

  // 2-4. From the queue cards
  const cards = wholeQueue(ctx);
  const dueName = due.title;
  const item = (c: any, text: string, cls: string) => ({ name: String(c.name || '').replace(/ \(\+1 car\)$/, ''), text, car: c.model + ' · ' + c.reg, cls, open: open(c.pick) });
  const pending = cards.filter((c) => on(c.pendShow)).map((c) => item(c, 'Call made, outcome not logged', '-orange'));
  const ai = cards.filter((c) => on(c.aiShow) && c.aiText === 'AI qualified').map((c) => item(c, 'Told the AI they want to renew', '-purple'));
  const later = cards.filter((c) => on(c.cbShow) && String(c.name || '').indexOf(dueName) !== 0)
    .map((c) => item(c, c.cbText, '-blue'));

  const count = (due.show ? 1 : 0) + pending.length + ai.length;
  const none = !due.show && !snoozed && !pending.length && !ai.length && !later.length;
  return {
    due, pending, ai, later,
    hasPending: pending.length > 0, hasAi: ai.length > 0, hasLater: later.length > 0,
    count: count > 9 ? '9+' : count ? String(count) : '',
    aria: count ? 'Alerts, ' + count + (count === 1 ? ' needs you' : ' need you') : 'Alerts',
    none,
  };
}
