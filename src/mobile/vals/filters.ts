import type { MobileCtx } from '../logic';
import { STAGES, stageView } from '../stages';

/** Category ids in the fixed order of the board's `fCats` (the board does not expose them on the items). */
const IDS = ['exp', 'ai', 'src', 'model', 'ins', 'ptype', 'status', 'nxt', 'ren', 'lang', 'kyc'];
const LIMIT = 'Up to 4 key filters. Remove one first.';

/** Phone-only values for the Filters sheet, available in the template as m.filters.* */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (v: any, ctx: MobileCtx): any {
  const s = ctx.self.state || {};
  const F = s.f || {};
  const monthsOn: string[] = F.months || [];
  const expanded = !!s.mFiltersOpen;
  const days = (n: number) => n + (n === 1 ? ' day' : ' days');

  // After a category opens, bring its header (and as much of its options as fits) into view.
  const reveal = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    window.requestAnimationFrame(() => {
      const sec = document.querySelector('.m-filters-sec.-open') as HTMLElement | null;
      if (!sec) return;
      sec.scrollIntoView({ block: 'nearest' });
      const head = sec.querySelector('.m-filters-cat') as HTMLElement | null;
      if (head) head.scrollIntoView({ block: 'nearest' });
    });
  };

  // The reason for an ignored star tap goes in the foot line: a toast would cover the sheet's Close button.
  const sayLimit = () => {
    ctx.set({ mFiltersLimit: true });
    if (typeof window !== 'undefined') window.setTimeout(() => ctx.set({ mFiltersLimit: false }), 5000);
  };

  // A star pins an option as a one-tap key filter on Today. The board ignores the tap at the limit: say why.
  const withStar = (o: any, n: number, pre: string) => {
    const on = o.favOn === 'true';
    const blocked = !on && o.favOp !== 1;
    return {
      ...o,
      uid: pre + n,
      zeroCls: o.count || o.on ? '' : '-zero',
      starCls: blocked ? '-dim' : '',
      starLabel: on ? 'Remove ' + o.label + ' from key filters' : 'Add ' + o.label + ' to key filters',
      star: (e: any) => {
        if (blocked) { sayLimit(); return; }
        o.fav(e);
      },
    };
  };

  const presets = (v.expPresets || []).map((p: any, n: number) => withStar(p, n, 'mfp'));
  // Renewal years read best in order (1st ... 7th), not by count
  const ordinal = (o: any) => { const m = /^(\d+)/.exec(String(o.label || '')); return m ? +m[1] : 99; };
  const curCat = (v.fCats || []).findIndex((c: any) => c.current === 'true');
  const catList = (v.catOpts || []).slice();
  if (IDS[curCat] === 'ren') catList.sort((a: any, b: any) => ordinal(a) - ordinal(b));
  const opts = catList.map((o: any, n: number) => withStar(o, n, 'mfo'));
  const months = (v.months || []).map((mo: any, n: number) => ({ ...mo, uid: 'mfm' + n, zeroCls: mo.count || mo.on ? '' : '-zero' }));

  const dragOn = F.preset === 'drag' && !monthsOn.length;
  const anyOn = !F.preset && !monthsOn.length;
  const presetOn = presets.find((p: any) => p.on);
  const expMax = Number(v.expMax) || 1;
  const setMax = (n: number) => v.onExpMax({ target: { value: Math.max(1, Math.min(90, n)) } });

  // "Any date": the board has no single handler that clears the expiry choice, so use the month
  // checkboxes (ticking a month clears a preset or the slider; unticking the last month clears all).
  const canClearExp = months.length > 0;
  const pickAny = () => {
    if (anyOn) return;
    if (monthsOn.length) {
      let guard = 40;
      for (;;) {
        const next = (ctx.fresh().months || []).find((mo: any) => mo.on);
        if (!next || guard-- <= 0) break;
        next.toggle();
      }
      return;
    }
    v.months[0].toggle();
    const again = (ctx.fresh().months || [])[0];
    if (again && again.on) again.toggle();
  };

  const expSummary = monthsOn.length ? monthsOn.join(', ') : dragOn ? 'Within ' + days(expMax) : presetOn ? presetOn.label : '';

  const cats = (v.fCats || []).map((c: any, n: number) => {
    const id = IDS[n] || '';
    const open = expanded && c.current === 'true';
    const summary = id === 'exp' ? expSummary : (F[id] || []).join(', ');
    return {
      label: c.label, badge: c.badge, hasBadge: !!c.badge, summary,
      badgeLabel: c.badge ? c.badge + ' selected' : '',
      open, openStr: open ? 'true' : 'false', openCls: open ? '-open' : '',
      isExp: open && id === 'exp', isList: open && id !== 'exp',
      panelId: 'mfpanel' + n,
      toggle: () => {
        if (open) { ctx.set({ mFiltersOpen: false }); return; }
        c.pick();
        ctx.set({ mFiltersOpen: true, mStageOpen: false });
        reveal();
      },
    };
  });

  // Stage (phone-only filter): open on its own, so it does not fight the board's one-open-category rule
  const sv = stageView(v, ctx);
  const stageOpen = !!s.mStageOpen;
  const stages = STAGES.map((st, n) => {
    const on = sv.picked.indexOf(st.id) >= 0, count = sv.counts[st.id] || 0;
    return { uid: 'mfs' + n, label: st.label, count, on, zeroCls: count || on ? '' : '-zero',
      toggle: () => ctx.set({ mStage: on ? sv.picked.filter((x: string) => x !== st.id) : sv.picked.concat([st.id]) }) };
  });
  const stage = {
    open: stageOpen, openStr: stageOpen ? 'true' : 'false', openCls: stageOpen ? '-open' : '',
    badge: sv.picked.length ? String(sv.picked.length) : '', summary: stages.filter((x) => x.on).map((x) => x.label).join(', '),
    toggle: () => { if (!stageOpen && expanded) ctx.set({ mFiltersOpen: false }); ctx.set({ mStageOpen: !stageOpen }); },
  };

  const shown = sv.shown;
  const tabNow = (v.tabs || []).find((t: any) => t.selected === 'true');
  const view = tabNow && tabNow.id !== 'all' ? tabNow.label : '';
  const footNote = shown === 0
    ? (view ? 'No leads match in the ' + view + ' view.' : 'No leads match these filters.')
    : (view ? 'Counting the ' + view + ' view only.' : '');
  const favN = String(v.favNote || '').split(' ')[0];
  const limitMsg = !!s.mFiltersLimit && favN === '4';

  return {
    cats, presets, opts, months,
    anyOn, canClearExp, pickAny,
    dragOn, pickDrag: () => setMax(expMax),
    daysText: days(expMax),
    dec: () => setMax(expMax - 1), inc: () => setMax(expMax + 1),
    decOff: expMax <= 1, incOff: expMax >= 90,
    rangeCls: dragOn ? '-on' : '',
    keyNote: favN + ' of 4 key filters on Today',
    keyCustom: ctx.shown(v.favResetShow),
    keyReset: () => v.favReset(),
    stage, stages,
    clearAll: () => { v.clearAll(); ctx.set({ mStage: [] }); },
    active: v.fCount, hasActive: !!v.hasChips || sv.picked.length > 0,
    showText: shown === 1 ? 'Show 1 lead' : 'Show ' + shown + ' leads',
    footNote: limitMsg ? LIMIT : footNote, hasFootNote: limitMsg || !!footNote, footCls: limitMsg ? '-warn' : '',
  };
}
