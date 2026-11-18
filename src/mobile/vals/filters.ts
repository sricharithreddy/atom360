import type { MobileCtx } from '../logic';

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

  // A star pins an option as a one-tap key filter on Today. The board ignores the tap at the limit: say why.
  const withStar = (o: any, n: number, pre: string) => {
    const on = o.favOn === 'true';
    const blocked = !on && o.favOp !== 1;
    return {
      ...o,
      uid: pre + n,
      zeroCls: o.count ? '' : '-zero',
      starCls: blocked ? '-dim' : '',
      starLabel: on ? 'Remove ' + o.label + ' from key filters' : 'Add ' + o.label + ' to key filters',
      star: (e: any) => {
        if (blocked) { ctx.note(LIMIT); return; }
        o.fav(e);
        ctx.note(on ? 'Removed from key filters on Today.' : 'Added to key filters on Today.');
      },
    };
  };

  const presets = (v.expPresets || []).map((p: any, n: number) => withStar(p, n, 'mfp'));
  const opts = (v.catOpts || []).map((o: any, n: number) => withStar(o, n, 'mfo'));
  const months = (v.months || []).map((mo: any, n: number) => ({ ...mo, uid: 'mfm' + n, zeroCls: mo.count ? '' : '-zero' }));

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
        ctx.set({ mFiltersOpen: true });
        reveal();
      },
    };
  });

  const shown = Number(v.shownCount) || 0;
  const tabNow = (v.tabs || []).find((t: any) => t.selected === 'true');
  const view = tabNow && tabNow.id !== 'all' ? tabNow.label : '';
  const footNote = shown === 0
    ? (view ? 'No leads match in the ' + view + ' view.' : 'No leads match these filters.')
    : (view ? 'Counting the ' + view + ' view only.' : '');
  const favN = String(v.favNote || '').split(' ')[0];

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
    keyReset: () => { v.favReset(); ctx.note('Key filters are back to the default.'); },
    active: v.fCount, hasActive: !!v.hasChips,
    showText: shown === 1 ? 'Show 1 lead' : 'Show ' + shown + ' leads',
    footNote, hasFootNote: !!footNote,
  };
}
