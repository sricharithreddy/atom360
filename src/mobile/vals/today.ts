import type { MobileCtx } from '../logic';
import { copyText } from '../copy';
import { cleanWhy, hasTime } from '../text';

const SNOOZE_MS = 10 * 60 * 1000;
const LIVE_BG = '#166534';
const BLOCKED_BG = '#DDE1EE';
const MAX_TAGS = 3;

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

// Interest (Hot / Warm / Cold) is worked out by the board per open lead only. Read it once for every
// lead from a team-lead view (it is fixed sample data); "AI qualified" always means Hot, as on the lead page.
let MOODS: Record<string, string> | null = null;
const plainName = (n: any) => String(n || '').replace(/ \(\+1 car\)$/, '').replace(/ \+1 vehicle$/, '');
function moodOf(ctx: MobileCtx, name: any): string {
  if (!MOODS) {
    const self: any = ctx.self, saved = self.state;
    MOODS = {};
    try {
      for (let k = 0; k < 40; k++) {
        self.state = { ...saved, me: 'ravi', sel: k, open: true, aiq: {} };
        const vals = ctx.fresh();
        if (!vals.sel || !vals.sel.name) break;
        const it = ((vals.pn && vals.pn.stats) || []).filter((x: any) => x.k === 'Interest')[0];
        MOODS[plainName(vals.sel.name)] = it ? String(it.v) : '';
      }
    } catch { /* fall back to grey */ } finally { self.state = saved; }
  }
  return MOODS[plainName(name)] || '';
}
const SEP2 = /\s*·\s*/;
const MOOD_CLS: Record<string, string> = { Hot: '-hot', Warm: '-warm', Cold: '-cold' };

/** Phone values for the Today queue (m.today.*). Thin: regroups board values for the phone card and wraps a few handlers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (v: any, ctx: MobileCtx): any {
  const self = ctx.self;
  const s = self.state;
  const on = ctx.shown;
  const isTeam = on(v.adm && v.adm.navShow);
  const cb = v.cb || {};

  // A lead opened from the queue always starts on its Overview tab.
  const landed = () => ctx.set({ mTab: 'sum', mSheet: null });
  const liveCall = s.cs && s.cs.st === 'live' ? s.cs : null;

  const card = (c: any) => {
    const live = c.callBg === LIVE_BG;
    const blocked = c.callBg === BLOCKED_BG;

    // Tags: only what the summary box, the streak and the circle do not already say.
    const tags: any[] = [];
    const rtype = (/·\s*(OD only|TP only)\s*$/.exec(String(c.prevCo || '')) || [])[1] || '';
    if (rtype) tags.push({ text: rtype, cls: 'm-today-rtag', ai: false });
    if (on(c.pendShow)) tags.push({ text: 'Outcome not logged', cls: '-orange', ai: false });
    if (on(c.aiShow) && c.aiText !== 'AI qualified') tags.push({ text: /^With AI/.test(c.aiText) ? 'With AI' : c.aiText, cls: '-purple', ai: true });
    if (on(c.kycShow)) tags.push({ text: 'KYC pending', cls: '-orange', ai: false });

    // The quote the board ranks first among those that have a price.
    const best = (c.quotes || []).filter((q: any) => q.n > 0)[0] || null;

    // "Next call 3:15 pm" -> "3:15 pm". "Call now" repeats the group heading, so it is not shown.
    const rawTime = on(c.timeShow) ? String(c.timeChip || '') : '';
    const time = rawTime === 'Call now' ? '' : rawTime.replace(/^Next call\s+/, '');

    // Days to expiry as a number in a circle: negative once the policy has expired
    const dm = /(\d+)/.exec(String(c.daysLeft || ''));
    const dn = dm ? parseInt(dm[1], 10) : null;
    const expired = /expired/i.test(String(c.daysLeft || ''));
    const days = dn == null ? '' : expired ? '−' + dn : String(dn);
    const daysCls = expired ? '-expired' : dn != null && dn <= 7 ? '-soon' : dn != null && dn <= 15 ? '-near' : '';
    const daysAria = expired ? 'Policy expired ' + dn + (dn === 1 ? ' day' : ' days') + ' ago, on ' + c.polDate : dn != null ? dn + (dn === 1 ? ' day' : ' days') + ' to expiry, ends ' + c.polDate : 'Expiry date not known';

    const mood = blocked ? '' : (c.aiText === 'AI qualified' ? 'Hot' : moodOf(ctx, c.name));
    const moodCls = MOOD_CLS[mood] || '-none';
    const moodSay = blocked ? 'Calling blocked' : mood ? mood + ' lead' : 'Interest not known';

    // One summary line: the reason, without what the circle or the tags show
    const reason = cleanWhy(c.why);
    const late = on(c.cbShow) && /late/.test(String(c.cbText || '')) ? (String(c.cbText).split(SEP2).filter((x: string) => /late/.test(x))[0] || '') : '';

    // Vehicle: one slim line (model · reg) that opens to the chassis and engine/motor numbers, each copyable
    const key = plainName(c.name);
    const vehOpen = !!((s.mCardVeh || {})[key]);
    const carRows: any[] = c.car || [];
    const vnum = (re: RegExp) => carRows.filter((x: any) => re.test(x.k))[0] || null;
    const copiedKey = s.mCopied || '';
    const vrows = [vnum(/^Reg/), vnum(/^Chassis/), vnum(/^(Engine|Motor)/)].filter(Boolean).map((x: any) => {
      const id = key + ':' + x.k;
      return { k: x.k, v: x.v, copied: copiedKey === id, label: 'Copy ' + String(x.k).toLowerCase() + ' ' + x.v, copy: () => copyText(ctx, x.v, x.k + ' copied', id) };
    });

    return {
      moodCls, moodSay,
      summary: reason, hasSummary: !!reason,
      boxTime: reason && hasTime(reason) ? '' : time, late,
      pulseCls: mood === 'Hot' ? '-good' : mood === 'Warm' ? '-warn' : '',
      vehOpen, vehOpenStr: vehOpen ? 'true' : 'false', vrows,
      toggleVeh: () => { const all = { ...(ctx.self.state.mCardVeh || {}) }; all[key] = !vehOpen; ctx.set({ mCardVeh: all }); },
      days, daysCls, daysAria, hasDays: !!days,
      name: c.name, model: c.model, reg: c.reg,
      why: c.why, whyFg: c.whyFg,
      daysLeft: c.daysLeft, daysFg: c.daysFg, polDate: c.polDate,
      time, hasTime: !!time,
      tags: tags.slice(0, MAX_TAGS), hasTags: tags.length > 0, hasMeta: tags.length > 0,
      hasQuote: !!best, quoteIns: best ? best.ins : '', quoteAmt: best ? best.amt : '',
      live, blocked, ready: !live && !blocked,
      callText: c.callLabel,
      callCls: live ? '-good' : blocked ? '-off' : '-primary',
      callAria: live ? 'On call with ' + c.name + '. Open the call' : blocked ? 'Calling is blocked: ' + c.callLabel + '. Open ' + c.name : 'Call ' + c.name,
      open: () => { c.pick(); landed(); },
      call: () => {
        const other = !!liveCall && !live && !blocked;
        c.call();
        landed();
        if (blocked) ctx.note('Calling is blocked for this lead: ' + String(c.callLabel).toLowerCase() + '.');
        else if (other) ctx.note('Your earlier call was ended. Its outcome is not logged yet.');
      },
      wa: () => {
        c.wa();
        landed();
        if (!self.state.msg) {
          // Same words as the lead page uses for this block.
          const why = (self.state.dnc || {})[self.state.sel];
          ctx.note('Messages are off for this lead.' + (why === 'num' ? ' This number is marked wrong. Messages stop until the correct number is added.'
            : why === 'all' ? ' The customer asked for no calls and no messages.' : ''));
        }
      },
    };
  };

  const groups = (v.groups || []).map((g: any) => ({
    title: g.title, fg: g.fg, count: g.count, caption: cap(g.caption),
    cards: (g.cards || []).map(card),
  }));

  const tabs = (v.tabs || []).map((t: any) => ({
    label: t.label, count: t.count, selected: t.selected, pick: t.pick,
    countCls: t.id === 'due' && t.count > 0 ? 'm-today-due' : '',
  }));
  const curTab = (v.tabs || []).filter((t: any) => t.selected === 'true')[0] || null;
  const allTab = (v.tabs || []).filter((t: any) => t.id === 'all')[0] || null;
  const onAll = !curTab || curTab.id === 'all';

  const filtered = !!v.hasChips;
  const empty = groups.length === 0;
  const emptyTitle = filtered ? 'No leads match these filters' : onAll ? 'No leads in your queue' : 'No leads in ' + curTab.label;
  const emptyBody = filtered
    ? (onAll ? 'Clear the filters to see all your leads.' : 'Clear the filters, or look in All.')
    : onAll ? 'New leads appear here when they are given to you.' : 'Nothing needs you here right now.';

  // The board's snooze has no timer. Bring the banner back after 10 minutes, as the button promises.
  const snooze = () => {
    cb.snooze();
    if (self.__mTodaySnz) clearTimeout(self.__mTodaySnz);
    self.__mTodaySnz = setTimeout(() => {
      self.__mTodaySnz = null;
      if (self.state.snz) ctx.fresh().cb.unsnooze();
    }, SNOOZE_MS);
  };
  const unsnooze = () => {
    if (self.__mTodaySnz) { clearTimeout(self.__mTodaySnz); self.__mTodaySnz = null; }
    cb.unsnooze();
  };

  return {
    scope: isTeam ? 'Team today' : 'Your day so far',
    callsW: (() => { const c = parseInt(String(v.hs && v.hs.calls).replace(/[^0-9]/g, ''), 10) || 0, t = parseInt(String(v.hs && v.hs.callsT).replace(/[^0-9]/g, ''), 10) || 0; return t ? Math.min(100, Math.round((c / t) * 100)) + '%' : '0%'; })(),
    hasPills: (v.quick || []).length > 0 || (v.chips || []).length > 0,
    // callback banner
    cbShow: on(cb.homeShow), cbSnoozed: on(cb.snoozedShow),
    cbSnoozeText: String(cb.snoozeText || '').replace(/\s*It comes back on its own\.?/, ''),
    cbCall: () => { cb.callNow(); landed(); },
    snooze, unsnooze,
    // tabs and filters
    tabs,
    fOn: Number(v.fCount) > 0,
    quick: (v.quick || []).map((q: any) => ({ label: q.label, count: q.count, press: q.press, pick: q.pick, ai: on(q.sparkShow), cls: on(q.sparkShow) ? '-ai' : '' })),
    filtered,
    // queue
    groups, empty, emptyTitle, emptyBody,
    emptyClear: empty && filtered,
    emptyAll: empty && !onAll && !!allTab,
    showAll: () => { if (allTab) allTab.pick(); },
  };
}
