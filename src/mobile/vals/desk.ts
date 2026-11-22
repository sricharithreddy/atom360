import type { MobileCtx } from '../logic';
import { addedCards } from '../added';
import { STAGES, stagesByName, plainName } from '../stages';
import { cardPriority } from './today';
import { profileOf } from '../profile';

/** Values the desktop board uses for features that started on the phone (m.dk.*). The desktop parts
 *  that use them are added to the board's template by src/desk/inject.ts. */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** The board's own queue, adjusted the way the phone adjusts it: app-set priority stars (the caller
 *  cannot change them), a sponsored insurer's leads first, and the Stage filter. Also an updated
 *  mobile number or email in the contact rows. */
export function deskPatch(v: any, m: any, ctx: MobileCtx): any {
  const s = ctx.self.state;
  const picked: string[] = s.mStage || [];
  const stages = picked.length ? stagesByName(ctx) : {};
  const groups = (v.groups || []).map((g: any) => {
    const cards = (g.cards || [])
      .filter((c: any) => !picked.length || picked.indexOf(stages[plainName(c.name)] || 'new') >= 0)
      .map((c: any) => {
        const { prio, sponsored } = cardPriority(ctx, c);
        const label = 'Priority ' + prio + ' of 5, set by the app';
        return {
          ...c, dSponsor: sponsored, starLabel: label,
          stars: [1, 2, 3, 4, 5].map((n) => ({ label, press: 'false', fill: n <= prio ? '#F5A623' : 'none', stroke: n <= prio ? '#E08E0B' : '#B6BDD6', pick: (e: any) => { if (e && e.stopPropagation) e.stopPropagation(); } })),
        };
      })
      .sort((a: any, b: any) => (a.dSponsor === b.dSponsor ? 0 : a.dSponsor ? -1 : 1));
    return { ...g, cards, count: cards.length };
  }).filter((g: any) => g.cards.length > 0);
  const cust = m.cust || {};
  return { groups, mobileText: cust.mobileText || v.mobileText, emailText: cust.emailText || v.emailText };
}

export default function (v: any, ctx: MobileCtx): any {
  const s = ctx.self.state;
  const picked: string[] = s.mStage || [];
  // added policies are new leads: they follow the Stage filter like the rest
  const added = picked.length && picked.indexOf('new') < 0 ? [] : addedCards(ctx);
  const counts: Record<string, number> = {};
  if (!ctx.self.__alt) {
    const map = stagesByName(ctx);
    (v.groups || []).forEach((g: any) => (g.cards || []).forEach((c: any) => { const st = map[plainName(c.name)] || 'new'; counts[st] = (counts[st] || 0) + 1; }));
  }
  const prof = profileOf(ctx, (v.sel || {}).name);
  return {
    added, hasAdded: added.length > 0, addedCount: added.length === 1 ? '1 lead' : added.length + ' leads',
    stageOpts: [{ val: '', label: 'Any stage', on: !picked.length }].concat(STAGES.map((st) => ({ val: st.id, label: st.label + ' (' + (counts[st.id] || 0) + ')', on: picked.length === 1 && picked[0] === st.id }))),
    onStage: (e: any) => { const val = e && e.target ? String(e.target.value) : ''; ctx.set({ mStage: val ? [val] : [] }); },
    stageOn: picked.length > 0,
    // Records → Service (visits to our workshop)
    recSvc: s.rec === 'svc', recSvcSel: s.rec === 'svc' ? 'true' : 'false', toSvc: () => ctx.set({ rec: 'svc', mHistSeg: 'svc' }),
    soldChip: prof.sold === 'us' ? 'Sold by us' + (prof.soldYear ? ' · ' + prof.soldYear : '') : 'Bought elsewhere', soldUs: prof.sold === 'us',
  };
}
