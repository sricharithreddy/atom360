import type { MobileCtx } from '../logic';

/** Phone-only values for the lead Overview tab, available in the template as m.sum.* */
/* eslint-disable @typescript-eslint/no-explicit-any */

// The board gives each "thing to know" a text colour; the phone turns it into a named tone (icon + class).
const TONES: Record<string, string> = { '#2A37B8': 'info', '#9A3412': 'warn', '#A3134F': 'stop', '#6A26D0': 'ai' };
const cap = (t: any) => { const s = String(t || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };
const rupees = (t: any) => { const n = parseInt(String(t || '').replace(/[^0-9]/g, ''), 10); return /₹/.test(String(t || '')) && n > 0 ? n : 0; };

export default function (v: any, ctx: MobileCtx): any {
  const sel = v.sel || {}, pn = v.pn || {}, co = v.co || {}, ow = v.ow || {}, cb = v.cb || {};
  const flagsIn: any[] = v.flags || [];
  const viewOnly = ctx.shown(ow.roShow);
  const blocked = ctx.shown(co.blockShow) && !viewOnly;
  const first = flagsIn[0] || {};
  const owner = /^Owner: /.test(first.label || '') ? String(first.label).replace(/^Owner: /, '') : '';

  // ---- callback due on another lead
  const cbShow = ctx.shown(cb.panelShow);
  // The board's snooze has no timer. Bring the alert back after 10 minutes, the same way (and with the same timer) as Today does.
  const self: any = ctx.self;
  const cbSnooze = (e: any) => {
    cb.snooze(e);
    if (self.__mTodaySnz) clearTimeout(self.__mTodaySnz);
    self.__mTodaySnz = setTimeout(() => { self.__mTodaySnz = null; if (self.state.snz) ctx.fresh().cb.unsnooze(); }, 10 * 60 * 1000);
    ctx.note('Snoozed for 10 minutes. You can bring it back sooner from Today.');
  };

  // ---- one banner: view only, or calling blocked
  const banner = viewOnly
    ? { show: true, cls: '-info', stop: false, title: owner ? 'View only · ' + owner + '’s lead' : 'View only', text: co.blockWhy || 'Only the owner or a team lead can call or change this lead. You can send WhatsApp or email.' }
    : blocked
      ? { show: true, cls: '-bad', stop: true, title: (v.callBg === '#8A93B3' && v.callLabel) || 'You cannot call this lead', text: co.blockWhy || '' }
      : { show: false, cls: '', stop: false, title: '', text: '' };

  // ---- next steps (lapsed policy, payment and policy)
  const strips = (v.strips || []).map((sp: any, si: number) => {
    const steps = (sp.steps || []).map((s2: any) => {
      const done = s2.n === '✓', cur = !done && s2.bg !== 'transparent';
      return { n: s2.n, label: s2.label, cls: done ? '-done' : cur ? '-cur' : '', state: done ? 'done' : cur ? 'current step' : 'to do', cur: cur ? 'step' : 'false' };
    });
    const acts = (sp.acts || []).map((a2: any, ai: number) => ({
      label: a2.label,
      cls: a2.bg === '#FFFFFF' ? '' : '-primary',
      pick: (e: any) => {
        // sending the policy copy closes the lead as Renewed: ask first
        if (/policy copy/i.test(a2.label)) {
          ctx.confirm({
            title: 'Send the policy copy?',
            body: 'It goes to ' + String(sel.name || 'the customer') + ' on WhatsApp and this lead is closed as Renewed.',
            yes: 'Send and close lead',
            run: () => {
              const now = (((ctx.fresh().strips || [])[si] || {}).acts || [])[ai];
              if (now && typeof now.pick === 'function' && now.label === a2.label) { now.pick(); ctx.note('Policy copy sent on WhatsApp. Lead closed as Renewed.'); }
            },
          });
          return;
        }
        a2.pick(e);
        ctx.note(/^Resend/.test(a2.label) ? 'Link sent again on WhatsApp.' : 'Self-inspection link sent on WhatsApp.');
      },
    }));
    const lapsed = /LAPSED/.test(sp.title || '');
    return {
      title: lapsed ? 'Policy lapsed' : 'Payment and policy', cls: lapsed ? '-lapsed' : '-pay',
      head: sp.head, sub: sp.sub, steps, acts, hasActs: acts.length > 0,
      demoShow: ctx.shown(sp.demoShow), demoLabel: cap(String(sp.demoLabel || '').replace(/^Demo:\s*/, '')), demo: sp.demo,
    };
  });

  // ---- things to know
  const know = flagsIn
    // the banner above already gives the block reason
    .filter((fl: any) => !(blocked && fl.sub && fl.sub === co.blockWhy))
    .map((fl: any, idx: number) => {
      const tone = TONES[fl.fg] || 'plain';
      const opts = (Array.isArray(fl.selOpts) ? fl.selOpts : []).map((opt: any) => ({ val: opt.val, on: !!opt.on, label: opt.label + (opt.on ? ' (owner now)' : '') }));
      const hasSel = ctx.shown(fl.selShow) && opts.length > 1;
      const hasAct = ctx.shown(fl.actShow) && !!fl.actLabel;
      let sub = fl.sub || '';
      // the banner already says "view only" and what is still possible
      if (viewOnly && idx === 0) sub = sub.replace(/^View only\. You can send WhatsApp or email\.\s*/, '');
      const cur = opts.filter((opt: any) => opt.on)[0];
      return {
        label: fl.label, sub, hasSub: !!sub, tone, cls: '-' + tone,
        isAi: tone === 'ai', isStop: tone === 'stop', isWarn: tone === 'warn', isOwner: idx === 0, isNote: idx > 0 && (tone === 'info' || tone === 'plain'),
        hasSel, opts,
        onSel: (e: any) => {
          const to = e && e.target ? e.target.value : '';
          if (!to || (cur && cur.val === to)) return;
          ctx.confirm({
            title: 'Move this lead to ' + to + '?',
            body: String(sel.name || 'This lead') + ' leaves ' + (cur ? cur.val + '’s' : 'the current') + ' list now. The sale will count for ' + to + '.',
            yes: 'Move lead',
            run: () => {
              const now = (ctx.fresh().flags || [])[0];
              if (now && typeof now.onSel === 'function') { now.onSel({ target: { value: to } }); ctx.note('Lead moved to ' + to + '.'); }
            },
          });
        },
        hasAct, actLabel: fl.actLabel || '',
        act: (e: any) => { if (typeof fl.act === 'function') fl.act(e); ctx.note('Merge request sent to your supervisor.'); },
      };
    });

  // ---- what to say (talking points the desktop computes but never shows)
  const say = (Array.isArray(sel.say) ? sel.say : []).filter((t: any) => !!t).map((t: any) => ({ t }));
  const hasObj = !!(sel.objQ && sel.objA);
  const hasTalk = say.length > 0 || !!sel.ask || hasObj;

  // ---- quotes teaser
  const priced = (v.qTabs || []).map((qt: any) => ({ name: qt.name, amt: qt.amt, n: rupees(qt.amt) })).filter((qt: any) => qt.n > 0);
  const best = priced.slice().sort((a: any, b: any) => a.n - b.n)[0];
  const qStat = (pn.stats || []).filter((row: any) => row.k === 'Quotes')[0];
  const qn = qStat ? parseInt(qStat.v, 10) || 0 : 0;
  const quotes = {
    has: qn > 0,
    title: qn > 0 ? qn + (qn === 1 ? ' quote' : ' quotes') : 'No quotes yet',
    sub: qn > 0 ? (best ? 'Best price ' + best.amt + ' · ' + best.name : 'No price filled in yet') : (viewOnly ? 'Nothing has been added for this customer.' : blocked ? 'Add one to send by message.' : 'Add one before you call.'),
    btn: qn > 0 ? 'See quotes' : (viewOnly ? 'Open quotes' : 'Add a quote'),
  };

  // ---- recent history
  const all: any[] = v.histRows || [];
  const hist = all.slice(0, 3).map((row: any) => ({ when: row.when, by: row.by, t: row.t, meta: row.meta, cls: row.by === 'AI' ? '-purple' : '-blue' }));
  const more = all.length - hist.length;

  return {
    cbShow, cbText: cb.text, cbSub: cb.sub, cbCall: cb.callNow, cbSnooze,
    banner,
    next: pn.nextText, hasNext: !!pn.nextText,
    strips, hasStrips: strips.length > 0,
    know, hasKnow: know.length > 0,
    summary: pn.summary, hasSummary: !!pn.summary,
    facts: (pn.stats || []).map((row: any) => ({ k: row.k, v: row.v, sub: row.sub, fg: row.fg })),
    hasTalk, say, hasSay: say.length > 0, ask: sel.ask || '', hasAsk: !!sel.ask, hasObj, objQ: sel.objQ || '', objA: cap(sel.objA),
    quotes,
    hist, hasHist: hist.length > 0,
    histAllLabel: more > 0 ? 'See all history (' + all.length + ')' : 'Open full history',
    // the board's handler picks the History records tab; then show the Customer tab where it lives
    seeHist: () => { if (typeof v.viewHistory === 'function') v.viewHistory(); ctx.set({ mTab: 'cust', mCustJump: Date.now() }); },
  };
}
