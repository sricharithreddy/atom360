import type { MobileCtx } from '../logic';

/** Phone-only values for the lead Overview tab, available in the template as m.sum.* */
/* eslint-disable @typescript-eslint/no-explicit-any */

// The board gives each "thing to know" a text colour; the phone turns it into a named tone (icon + class).
const TONES: Record<string, string> = { '#2A37B8': 'info', '#9A3412': 'warn', '#A3134F': 'stop', '#6A26D0': 'ai' };
const cap = (t: any) => { const s = String(t || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };
const rupees = (t: any) => { const n = parseInt(String(t || '').replace(/[^0-9]/g, ''), 10); return /₹/.test(String(t || '')) && n > 0 ? n : 0; };

// Chassis and engine numbers live only on the board's queue cards. Read them once from a team-lead
// view of all leads (they are fixed sample data), keyed by customer name.
let VEHICLES: Record<string, any> | null = null;
const plain = (n: any) => String(n || '').replace(/ \(\+1 car\)$/, '').replace(/ \+1 vehicle$/, '');
function vehicleOf(ctx: MobileCtx, name: any): any {
  if (!VEHICLES) {
    const self: any = ctx.self, saved = self.state;
    VEHICLES = {};
    try {
      self.state = { ...saved, me: 'ravi', tab: 'all', f: { preset: null, expMax: 30, months: [], ai: [], src: [], model: [], ins: [], ptype: [], status: [], nxt: [], ren: [], lang: [], kyc: [] } };
      const all = ctx.fresh();
      (all.groups || []).forEach((g: any) => (g.cards || []).forEach((c: any) => { VEHICLES![plain(c.name)] = { car: c.car, prevCo: c.prevCo }; }));
    } finally { self.state = saved; }
  }
  return VEHICLES[plain(name)] || null;
}

/** Copy to the clipboard (with a fallback for browsers that block it) and say so. */
function copyText(ctx: MobileCtx, text: string, done: string, key: string): void {
  if (!text) return;
  const ok = () => {
    ctx.set({ mCopied: key, mToast: done });
    setTimeout(() => { if (ctx.self.state.mCopied === key) ctx.set({ mCopied: '' }); }, 2000);
  };
  const fallback = () => {
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); ok();
    } catch { ctx.note('Could not copy. Press and hold the number to copy it.'); }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  } catch { fallback(); }
}

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
    if (/renewed (with us|this customer)|issued the policy|Not renewed/i.test(String(fl.label || ''))) return; // the policy card covers this
    const label = String(fl.label || '').replace(/\.$/, '');
    if (!label) return;
    chips.push({ t: label, cls: tone === 'ai' ? '-purple' : tone === 'warn' ? '-orange' : tone === 'stop' ? '-red' : '' });
    if (ctx.shown(fl.actShow) && fl.actLabel) merge = { label: fl.actLabel, act: (e: any) => { if (typeof fl.act === 'function') fl.act(e); ctx.note('Merge request sent to your supervisor.'); } };
  });

  // ---- vehicle: reg, chassis, engine/motor numbers, each with copy
  const card = vehicleOf(ctx, sel.name);
  const lead = ctx.self.state.sel;
  const copied = ctx.self.state.mCopied || '';
  const vrow = (id: string, k: string, val: string) => ({
    id, k, v: val || 'Not known', has: !!val,
    copied: copied === lead + ':' + id,
    copyLabel: 'Copy ' + k.toLowerCase() + ' ' + val,
    copy: () => copyText(ctx, val, k + ' copied', lead + ':' + id),
  });
  const carRows: any[] = card ? (card.car || []) : [];
  const carVal = (re: RegExp) => ((carRows.filter((x: any) => re.test(x.k))[0] || {}).v || '');
  const engineK = carRows.some((x: any) => /^Motor/.test(x.k)) ? 'Motor no' : 'Engine no';
  const vehicle = {
    model: carVal(/^Model/) || String(sel.vehicle || '').split(' · ')[0],
    ev: engineK === 'Motor no',
    rows: [vrow('reg', 'Reg no', carVal(/^Reg/)), vrow('chassis', 'Chassis no', carVal(/^Chassis/)), vrow('engine', engineK, carVal(/^(Engine|Motor)/))],
  };

  // ---- policy: renewal type first (OD only / TP only / OD + TP), then the details needed to quote
  const pp = v.pp || {};
  const tile = (k: string) => ((pp.tiles || []).filter((t: any) => t.k === k)[0] || {}) as any;
  const typeRaw = String(pp.typeLine || '').split(' · ')[0] || String(card && card.prevCo ? String(card.prevCo).split(' · ')[1] || '' : '');
  const known = !!pp.ins && pp.ins !== 'Not known' && !!typeRaw;
  const od = tile('Own damage cover'), tp = tile('Third party cover');
  const tpEnd = String(tp.v || '').split(' – ')[1] || '';
  const odEnd = String(od.v || '').split(' – ')[1] || '';
  const rtype = !known ? { label: 'Policy type not known', note: 'Ask for last year’s policy copy.', cls: '-unknown' }
    : /OD only/i.test(typeRaw) ? { label: 'OD only renewal', note: 'Third party is already covered till ' + (tpEnd || 'a later year') + '. Quote own damage only.', cls: '-od' }
    : /TP only/i.test(typeRaw) ? { label: 'TP only renewal', note: 'Third party cover only. No own damage, no NCB.', cls: '-tp' }
    : { label: 'OD + TP renewal', note: 'Own damage and third party renew together.', cls: '-both' };
  const claim = (v.claimOpts || []).filter((o: any) => o.press === 'true')[0];
  const kv = (k: string, val: any, fg?: string) => ({ k, v: val || '—', fg: fg || '' });
  const policy = {
    type: rtype,
    polNo: known ? String(pp.polNo || '') : '',
    polCopied: copied === lead + ':pol',
    copyPol: () => copyText(ctx, String(pp.polNo || ''), 'Policy number copied', lead + ':pol'),
    insurer: known ? pp.ins : '',
    rows: [
      kv(/OD only/i.test(typeRaw) ? 'OD ends' : 'Policy ends', sel.end ? (odEnd || sel.end) + ' · ' + sel.days : odEnd, sel.daysFg),
      /OD only/i.test(typeRaw) ? kv('TP ends', tpEnd) : kv('Premium paid', tile('Premium paid').v),
      kv('NCB', sel.ncbNew ? String(sel.ncbNew).replace('→', ' → ') : sel.ncb),
      kv('IDV', sel.idv),
      kv('Claim last year', claim ? (claim.label === 'No claim' ? 'No' : 'Yes') : 'Not asked', claim ? '' : '#9A3412'),
      kv('Financed by', tile('Financed by').v || 'None'),
    ].filter((r) => r.v && r.v !== '—'),
  };

  if (/OD only|TP only/i.test(typeRaw) && known) chips.unshift({ t: /OD only/i.test(typeRaw) ? 'OD only renewal' : 'TP only renewal', cls: 'm-sum-chip-type' });
  const stat = (k: string) => (pn.stats || []).filter((row: any) => row.k === k)[0] || {};

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
    quotes,
    hasLast: !!last, lastT: last ? last.t : '', lastWhen: last ? last.when + ' · ' + last.by : '',
    attempts: (stat('Attempts').v || '0') + ' attempts',
    vehicle, policy,
  };
}
