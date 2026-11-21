import type { MobileCtx } from '../logic';

/** Phone-only values for the lead Overview tab, available in the template as m.sum.* */
/* eslint-disable @typescript-eslint/no-explicit-any */

// The board gives each "thing to know" a text colour; the phone turns it into a named tone (icon + class).
const TONES: Record<string, string> = { '#2A37B8': 'info', '#9A3412': 'warn', '#A3134F': 'stop', '#6A26D0': 'ai' };
const cap = (t: any) => { const s = String(t || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };
const rupees = (t: any) => { const n = parseInt(String(t || '').replace(/[^0-9]/g, ''), 10); return /₹/.test(String(t || '')) && n > 0 ? n : 0; };

export default function (v: any, ctx: MobileCtx): any {
  const sel = v.sel || {}, pn = v.pn || {}, co = v.co || {}, ow = v.ow || {};
  const flagsIn: any[] = v.flags || [];
  const viewOnly = ctx.shown(ow.roShow);
  const blocked = ctx.shown(co.blockShow) && !viewOnly;
  const first = flagsIn[0] || {};
  const owner = /^Owner: /.test(first.label || '') ? String(first.label).replace(/^Owner: /, '') : '';

  // ---- one banner: view only, or calling blocked
  const banner = viewOnly
    ? { show: true, cls: '-info', stop: false, title: owner ? 'View only · ' + owner + '’s lead' : 'View only', text: 'You can WhatsApp or email this customer. Calling and changes are for ' + (owner || 'the owner') + ' or a team lead.' }
    : blocked
      ? { show: true, cls: '-bad', stop: true, title: (v.callBg === '#8A93B3' && v.callLabel) || 'You cannot call this lead', text: String(co.blockWhy || '').split(/(?<=\.)\s/)[0] }
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

  // ---- things to know: short chips only (the long explanations stay on desktop)
  const chips: any[] = [];
  const interest = (pn.stats || []).filter((row: any) => row.k === 'Interest')[0];
  if (interest && interest.v && interest.v !== '—') chips.push({ t: interest.v + (/^(Hot|Warm|Cold)$/.test(interest.v) ? ' lead' : ''), cls: interest.v === 'Hot' ? '-green' : interest.v === 'Warm' ? '-orange' : '' });
  let reassign: any = null, merge: any = null;
  flagsIn.forEach((fl: any, idx: number) => {
    const tone = TONES[fl.fg] || 'plain';
    if (idx === 0) {
      if (owner && !viewOnly) chips.push({ t: 'Owner ' + owner, cls: '-blue' });
      const opts = (Array.isArray(fl.selOpts) ? fl.selOpts : []).map((opt: any) => ({ val: opt.val, on: !!opt.on, label: opt.label + (opt.on ? ' (owner now)' : '') }));
      if (ctx.shown(fl.selShow) && opts.length > 1) {
        const cur = opts.filter((opt: any) => opt.on)[0];
        reassign = {
          opts,
          onSel: (e: any) => {
            const to = e && e.target ? e.target.value : '';
            if (!to || (cur && cur.val === to)) return;
            ctx.confirm({
              title: 'Move this lead to ' + to + '?',
              body: String(sel.name || 'This lead') + ' leaves ' + (cur ? cur.val + '’s' : 'the current') + ' list now. The sale will count for ' + to + '.',
              yes: 'Move lead',
              run: () => { const now = (ctx.fresh().flags || [])[0]; if (now && typeof now.onSel === 'function') { now.onSel({ target: { value: to } }); ctx.note('Lead moved to ' + to + '.'); } },
            });
          },
        };
      }
      return;
    }
    if (blocked && fl.sub && fl.sub === co.blockWhy) return; // the banner says it
    const label = String(fl.label || '').replace(/\.$/, '');
    if (!label) return;
    chips.push({ t: label, cls: tone === 'ai' ? '-purple' : tone === 'warn' ? '-orange' : tone === 'stop' ? '-red' : '' });
    if (ctx.shown(fl.actShow) && fl.actLabel) merge = { label: fl.actLabel, act: (e: any) => { if (typeof fl.act === 'function') fl.act(e); ctx.note('Merge request sent to your supervisor.'); } };
  });

  // ---- key facts
  const pv = v.pv || {};
  const tile = (k: string) => ((pv.tiles || []).filter((t: any) => t.k === k)[0] || {}).v || '';
  const stat = (k: string) => (pn.stats || []).filter((row: any) => row.k === k)[0] || {};
  const facts = [
    { k: 'Policy ends', v: sel.end ? sel.end + ' · ' + sel.days : '', fg: sel.daysFg || '' },
    { k: 'Last year', v: [sel.prev && sel.prev !== 'Unknown' ? sel.prev : '', tile('Premium paid')].filter(Boolean).join(' · ') || 'Not known', fg: '' },
    { k: 'NCB', v: sel.ncbNew ? String(sel.ncbNew).replace('→', ' → ') : (sel.ncb || '—'), fg: '' },
    { k: 'IDV', v: sel.idv || '—', fg: '' },
    { k: 'Attempts', v: stat('Attempts').v || '0', fg: '' },
    { k: 'Last spoke', v: stat('Last spoke').v || '—', fg: '' },
  ].filter((f) => !!f.v);

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

  // ---- last contact
  const last = (v.histRows || [])[0] || null;

  return {
    banner,
    why: sel.why || sel.whyLong || '', whyFg: sel.whyFg || '',
    next: pn.nextText, hasNext: !!pn.nextText,
    strips, hasStrips: strips.length > 0,
    chips, hasChips: chips.length > 0,
    reassign, hasReassign: !!reassign,
    merge, hasMerge: !!merge,
    facts,
    quotes,
    hasLast: !!last, lastT: last ? last.t : '', lastWhen: last ? last.when + ' · ' + last.by : '',
  };
}
