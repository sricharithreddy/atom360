import type { MobileCtx } from '../logic';

/* eslint-disable @typescript-eslint/no-explicit-any */

const list = (x: any): any[] => (Array.isArray(x) ? x : []);
const onLabel = (opts: any): string => { const o = list(opts).find((x: any) => x.on); return o ? String(o.label) : ''; };
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);
const chCls = (ch: string) => (ch === 'WhatsApp' ? '-green' : '-blue');
/** Number choices for a small fixed range: the board's handler reads e.target.value, so a select can drive it. */
const range = (min: number, max: number, cur: any, label: (n: number) => string) => {
  const out: any[] = [];
  for (let n = min; n <= max; n++) out.push({ val: String(n), label: label(n), on: String(n) === String(cur) });
  return out;
};

/**
 * Phone-only values for Admin > Messages (m.admMsg.*).
 * Regroups the board's lists for cards, turns display strings into booleans and owns one page layer
 * (the template detail). Every change still goes through the board's own handlers.
 */
export default function (v: any, ctx: MobileCtx): any {
  const adm = v.adm || {};
  const s = ctx.self.state || {};
  const isAdmin = adm.lockPe === 'auto';
  const inMsg = ctx.shown(adm.show) && ctx.shown(adm.msgShow);

  // ---- template detail page ----
  const tplOpen = !!s.mAdmMsgTpl && inMsg && ctx.shown(adm.tShow);
  const fromJourney = tplOpen && s.mAdmMsgFrom === 'journey';
  const closeTpl = () => {
    const back = s.mAdmMsgFrom === 'journey';
    ctx.set({ mAdmMsgTpl: false, mAdmMsgFrom: null });
    // A template opened from a journey step goes back to the journey, not to the template list.
    if (back) { const j = list(ctx.fresh().adm.msTabs)[0]; if (j && j.pick) j.pick(); }
  };
  const openVia = (pick: () => void, from: string) => () => { pick(); ctx.set({ mAdmMsgTpl: true, mAdmMsgFrom: from }); };

  // While a template opened from the journey is on top, the journey stays underneath (keeps its scroll position).
  const pane = fromJourney ? 'journey' : ctx.shown(adm.tShow) ? 'tpl' : ctx.shown(adm.sShow) ? 'sent' : ctx.shown(adm.rShow) ? 'rules' : 'journey';

  // ---- journey: steps grouped by stage ----
  const groups: any[] = [];
  list(adm.steps).forEach((st: any) => {
    let grp = groups.length ? groups[groups.length - 1] : null;
    if (!grp || grp.g !== st.g) { grp = { g: st.g, color: st.bar, steps: [] }; groups.push(grp); }
    const off = st.effText === 'Not sent';
    grp.steps.push({
      ...st,
      modeText: onLabel(st.modeOpts),
      modeCls: off ? '-magenta' : '',
      off,
      hasStat: !!st.stat && st.stat !== '—',
      tps: list(st.tps).map((tp: any) => ({ ...tp, chCls: chCls(tp.ch), open: openVia(tp.open, 'journey') })),
    });
  });
  groups.forEach((grp) => { grp.countText = plural(grp.steps.length, 'step', 'steps'); });

  // ---- templates ----
  const tplRows = list(adm.tplRows).map((tr: any) => ({ ...tr, chCls: chCls(tr.ch), open: openVia(tr.pick, 'list') }));
  const tSend = ctx.shown(adm.tSendShow), tUndo = ctx.shown(adm.tUndoShow);
  const stCls = adm.tStFg === '#166534' ? '-green' : adm.tStFg === '#9A3412' ? '-orange' : '-magenta';

  // ---- sent log ----
  const ST_CLS: Record<string, string> = { Sent: '', Delivered: '-blue', Read: '-green', Replied: '-ink', Failed: '-magenta' };
  const sentRows = list(adm.sentRows).map((sr: any) => ({ ...sr, chCls: chCls(sr.ch), stCls: ST_CLS[sr.st] || '', hasNote: !!sr.note, byText: sr.by === 'Automatic' ? 'Sent automatically' : 'Sent by ' + sr.by }));

  // ---- sending rules ----
  const fbOn = !!adm.fb && adm.fb.press === 'true', pauseOn = !!adm.pause && adm.pause.press === 'true';
  const hours = (n: number) => plural(n, 'hour', 'hours');
  // Shorter option labels that fit a phone select; the values and handlers are the board's.
  const SHORT: Record<string, string> = { own: 'Each caller’s own WhatsApp', api: 'WhatsApp Business', cust: 'Customer’s language', en: 'English only' };
  const short = (opts: any) => list(opts).map((o: any) => ({ ...o, label: SHORT[o.val] || o.label }));
  const waModes = short(adm.waModes), langOpts = short(adm.langOpts);
  const waOwnMode = onLabel(waModes) === SHORT.own, langCust = onLabel(langOpts) === SHORT.cust;

  return {
    isAdmin, isLead: !isAdmin,
    isJourney: pane === 'journey', isTpl: pane === 'tpl', isSent: pane === 'sent', isRules: pane === 'rules',
    waOwn: adm.waBannerFg === '#9A3412',
    // journey
    groups, noSteps: groups.length === 0,
    // templates
    tplRows, tplNone: tplRows.length === 0, tplCountText: adm.tplCount + ' templates',
    tplOpen, closeTpl,
    tStCls: stCls, tIsWa: adm.tCh === 'WhatsApp',
    tHasBtns: ctx.shown(adm.tBtnsShow), tHasLangNote: ctx.shown(adm.tLangShow), tHasWarn: ctx.shown(adm.tWarnShow),
    tCountWarn: adm.tCountFg === '#9A3412',
    tCanSend: tSend, tCanUndo: tUndo, tFoot: isAdmin && (tSend || tUndo),
    tSend: () => { adm.tSend(); ctx.note('Sent for approval. The old wording keeps going out until it is approved.'); },
    tUndo: () => ctx.confirm({
      title: 'Undo your changes?',
      body: 'The wording of “' + adm.tName + '” goes back to the last version.',
      yes: 'Undo', danger: true,
      run: () => { const now = ctx.fresh().adm; if (ctx.shown(now.tUndoShow)) now.tUndo(); },
    }),
    // sent log
    sentRows, sentNone: !ctx.shown(adm.sentEmpty) ? false : true, sentCountText: plural(sentRows.length, 'message', 'messages'),
    // sending rules
    capDayOpts: range(1, 5, adm.capDay, String), capWeekOpts: range(1, 14, adm.capWeek, String), fbHOpts: range(1, 24, adm.fbH, hours),
    waModes, langOpts,
    waHint: waOwnMode ? 'The caller sends each WhatsApp message with one tap.' : 'Automatic steps go by themselves.',
    langHint: langCust ? 'English is used when the customer’s language is not ready.' : 'Every customer gets the English wording.',
    fbOn, pauseOn, fbText: fbOn ? 'On' : 'Off', pauseText: pauseOn ? 'On' : 'Off',
    ro: {
      waMode: onLabel(waModes),
      quiet: onLabel(adm.qFrom) + ' to ' + onLabel(adm.qTo),
      caps: adm.capDay + ' a day, ' + adm.capWeek + ' a week',
      fb: fbOn ? 'After ' + hours(Number(adm.fbH) || 0) : 'Off',
      lang: onLabel(langOpts),
      pause: pauseOn ? 'On' : 'Off',
    },
    layers: [{ id: 'admin-template', open: tplOpen, close: closeTpl }],
  };
}
