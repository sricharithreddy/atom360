import type { MobileCtx } from '../logic';

/** Phone-only values for the Learn screen, available in the template as m.learn.* */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (v: any, ctx: MobileCtx): any {
  const ln = v.ln || {};
  const st = ctx.self.state || {};
  const list = (x: any): any[] => (Array.isArray(x) ? x : []);
  const pickEv = (val: string) => ({ target: { value: val } });

  // Tabs: short labels so all four fit a 360 px screen; the full name stays in the accessible name.
  const SHORT: Record<string, string> = { 'My coaching': 'Coaching', 'Team coaching': 'Coaching', 'Objection playbook': 'Playbook' };
  const tabs = list(ln.tabs).map((t: any) => ({
    label: SHORT[t.label] || t.label,
    full: t.label,
    selected: t.selected,
    pick: t.pick,
    badge: t.badge,
    hasBadge: !!t.badge && ctx.shown(t.badgeShow),
    badgeNote: t.label === 'Lessons' ? 'required, not done' : 'unread',
  }));

  // Skills by caller: one card per caller, each score labelled with its skill.
  const cols = list(ln.teamCols);
  const team = list(ln.teamSk).map((r: any) => {
    const cells = list(r.cells).map((ce: any, i: number) => ({
      label: cols[i] ? cols[i].t : '',
      v: ce.v,
      fg: ce.fg,
      low: String(ce.fw) === '700',
      cls: String(ce.fw) === '700' ? '-low' : '',
    }));
    const low = cells.find((c: any) => c.low);
    return { name: r.name, cells, hasLow: !!low, lowLabel: low ? low.label : '', lowV: low ? low.v : '' };
  });

  // Playbook filters.
  const plCat = st.plCat || 'All';
  const plQ = String(st.plQ || '');
  const plFiltered = plCat !== 'All' || plQ.trim() !== '';
  const plCats = list(ln.plCats).map((o: any) => ({
    label: o.val === 'All' ? 'All' : o.label,
    press: o.on ? 'true' : 'false',
    pick: () => ln.onPlCat(pickEv(o.val)),
  }));
  const plWhat = [plCat !== 'All' ? plCat : '', plQ.trim() ? '“' + plQ.trim() + '”' : ''].filter(Boolean).join(' + ');

  // Lessons.
  const lsCat = st.lsCat || 'All';
  const lsCats = list(ln.lsCats).map((o: any) => ({
    label: o.val === 'All' ? 'All' : o.label,
    press: o.on ? 'true' : 'false',
    pick: () => ln.onLsCat(pickEv(o.val)),
  }));
  const lessons = list(ln.lessons).map((ls: any) => {
    const done = ls.press === 'true';
    const must = ctx.shown(ls.mustShow);
    const due = String(ls.must || '');
    return {
      t: ls.t,
      meta: ls.meta,
      done,
      press: ls.press,
      must,
      mustText: done ? 'Required · done' : 'Required' + (due ? ' · ' + due.charAt(0).toLowerCase() + due.slice(1) : ''),
      mustCls: done ? '-green' : '-magenta',
      btn: done ? 'Done' : 'Mark done',
      btnCls: done ? '-done' : '',
      aria: (done ? 'Done. Mark as not done: ' : 'Mark as done: ') + ls.t,
      toggle: () => { ls.toggle(); ctx.note(done ? 'Marked as not done' : 'Marked as done'); },
    };
  });
  const mustOpen = ln.lsMustFg === '#A3134F';

  // What's new.
  const news = list(ln.news).map((nw: any) => {
    const unread = ctx.shown(nw.dotShow);
    return { t: nw.t, b: nw.b, when: nw.when, tag: nw.tag, tagBg: nw.tagBg, tagFg: nw.tagFg, unread, cls: unread ? '-unread' : '', read: nw.read };
  });
  const unreadN = news.filter((n: any) => n.unread).length;

  return {
    tabs,
    isCoach: ln.coachShow === 'flex',
    isPlay: ln.playShow === 'flex',
    isLess: ln.lessShow === 'flex',
    isNews: ln.newsShow === 'flex',
    isTeam: ln.teamShow === 'flex',
    team,
    plCats,
    plFiltered,
    plWhat,
    plEmpty: ctx.shown(ln.playEmptyShow),
    plClearQ: () => ln.onPlQ(pickEv('')),
    plHasQ: plQ !== '',
    plAll: () => { ln.onPlCat(pickEv('All')); ln.onPlQ(pickEv('')); },
    lsCats,
    lsFiltered: lsCat !== 'All',
    lsShownText: lessons.length + ' ' + lsCat + (lessons.length === 1 ? ' lesson' : ' lessons') + '. Progress counts all lessons.',
    lsAll: () => ln.onLsCat(pickEv('All')),
    lessons,
    mustCls: mustOpen ? '-open' : '-ok',
    mustOpen,
    news,
    canReadAll: ctx.shown(ln.readAllShow),
    unreadText: unreadN === 0 ? 'All caught up. Newest first.' : unreadN + ' unread',
    readAll: () => { ln.readAll(); ctx.note('All marked as read'); },
  };
}
