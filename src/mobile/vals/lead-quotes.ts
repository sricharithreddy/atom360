import type { MobileCtx } from '../logic';
import type { Share } from '../shares';

/** Phone values for the Quotes tab of the lead page (template: m.quotes.*).
 *  Thin: real booleans from the board's display strings, one read-only summary of the selected quote,
 *  and wrapped handlers. All quote rules (pricing, saving, who may edit) stay in the board. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (v: any, ctx: MobileCtx): any {
  const s = ctx.self.state;
  const ed = v.ed || {}, send = v.send || {}, pp = v.pp || {}, ow = v.ow || {};
  const on = ctx.shown;
  const canEdit = ow.pe === 'auto' || on(ow.ctlShow);

  // Which quote is selected. The board's tabs follow the order of panelQuotes, which carries the quote index.
  const tabs: any[] = v.qTabs || [], rows: any[] = v.panelQuotes || [];
  const isNew = on(ed.newShow), isLive = on(ed.liveShow);
  const at = tabs.findIndex((t) => t.sel === 'true');
  const qi = isNew ? -1 : (at >= 0 && rows[at] ? rows[at].qi : -2);
  const key = s.sel + ':' + (isNew ? 'new' : qi);
  const dirty = !isNew && !!(s.dfts || {})[key];

  // Modes of the quote card: read-only summary, edit form (existing manual quote), new-quote form.
  const editing = canEdit && !isNew && !isLive && qi >= 0 && (dirty || s.mQuotesEdit === key);
  const adding = canEdit && isNew;
  const form = editing || adding;
  const summary = !isNew && !editing && qi >= 0;

  // Read-only summary of the selected quote, the same for a live and a manual one.
  const total = String(ed.total || '');
  const hasAmt = isLive || !!total;
  const pick = (list: any[]) => { const o = (list || []).find((x) => x.on); return o ? o.label : ''; };
  const link = isLive ? String(ed.liveLink || '') : String(ed.link || '').trim();
  const lines = isLive
    ? (ed.liveLines || []).map((l: any) => ({ k: l.k, v: l.v }))
    : (ed.rows || []).map((r: any) => ({ k: r.k, v: (r.sign || '') + '₹' + (r.val || '0') })).concat([{ k: 'GST 18%', v: ed.gst }]);
  const copied = s.mQuotesCopied === key;
  const copyLink = () => {
    const done = () => { ctx.set({ mQuotesCopied: key }); setTimeout(() => { if (ctx.self.state.mQuotesCopied === key) ctx.set({ mQuotesCopied: null }); }, 1400); };
    const fail = () => ctx.note('Could not copy. Press and hold the link to copy it.');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, fail);
      else fail();
    } catch { fail(); }
  };
  const card = {
    total: isLive ? total : (total ? '₹' + total : ''),
    hasAmt, noAmt: !hasAmt,
    kind: isLive ? 'Live' : 'Manual', kindCls: isLive ? '-green' : '',
    idv: isLive ? ed.liveIdv : '₹' + ed.idvText,
    ncb: isLive ? ed.liveNcb : pick(ed.ncbOpts),
    addons: isLive ? ed.liveAdd : (ed.addons || 'None'),
    lines,
    hasLink: !!link, noLink: !link, link,
    linkNote: isLive ? 'From the insurer' : ed.linkPreview,
    copy: isLive ? ed.liveCopy : copyLink,
    copyText: isLive ? ed.liveCopyText : (copied ? 'Copied' : 'Copy'),
    source: isLive ? 'Price and link come from the insurer. To change the cover, re-quote on its portal and the live price updates here.' : '',
  };

  // Comparison with last year and the NCB check: tone from the board's colours.
  const cmpShow = on(ed.cmpShow), ncbShow = on(ed.ncbShow);
  const tone = (fg: string) => (fg === '#166534' ? '-good' : fg === '#9A3412' ? '-warn' : '');

  // The AI tick on a saved quote: tick and save in one step (nothing else is unsaved in the summary).
  const aiShow = on(ed.aiShow) && !isLive;
  const tickAndSave = () => { ed.onAiChecked(); const f = ctx.fresh(); if (f.ed && !f.ed.saveCant) f.ed.save(); };

  // Source of the figures (photo, file, pasted text)
  const busy = on(ed.zoneBusy), done = on(ed.zoneDone), bad = on(ed.zoneBad);
  const pasteOpen = adding && on(ed.bigShow) && (s.mQuotesPaste === key || !!String(ed.pasteText || '').trim());

  // Save, discard, close. Switching between the summary and the form starts at the top of the tab.
  const toTop = () => { if (typeof document === 'undefined') return; setTimeout(() => { const el = document.querySelector('[data-m-scroll="lead"]'); if (el) el.scrollTop = 0; }, 0); };
  const closeEdit = () => { ctx.set({ mQuotesEdit: null, mQuotesPaste: null }); toTop(); };
  const save = () => {
    if (ed.saveCant) { ctx.note(isNew ? 'Type the insurer’s name first.' : 'Nothing to save yet.'); return; }
    ed.save(); closeEdit(); reveal();
  };
  // On a view-only lead the board's reason ("Save your changes...") asks for something this user cannot do.
  const cantLine = !canEdit && dirty ? 'This quote has unsaved changes by someone who can edit it. It can be sent once they are saved' : String(send.line || '');
  const sendTap = () => { if (send.cant) ctx.note(cantLine + '.'); else send.open(); };

  // Keep the chosen insurer chip in view inside its sideways scroller (after a pick, an add or a save).
  const reveal = () => {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const el = document.querySelector('.m-quotes-chip[aria-selected="true"]');
      try { if (el) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch { /* not supported */ }
    }, 30);
  };
  const cpList: any[] = v.cpOpts || [];
  // ---- shared with the customer: quote cards and texts from the share log, plus quotes told on a call
  const shares: Share[] = ((ctx.self.state.mQshares || {})[ctx.self.state.sel]) || [];
  const told = (v.histRows || []).filter((h: any) => !/sent/i.test(String(h.t || '')) && /quote|agreed/i.test(String(h.t || '')) && h.by !== 'AI');
  const shared = shares.map((x) => ({ ch: x.ch, icon: x.ch === 'Email' ? 'mail' : 'wa', title: x.kind + (x.insurer ? ' · ' + x.insurer + (x.amt ? ' ' + x.amt : '') : ''), sub: x.ch + ' · ' + x.when + ' · ' + x.by }))
    .concat(told.map((h: any) => ({ ch: 'Call', icon: 'call', title: String(h.t), sub: 'On a call · ' + h.when + ' · ' + h.by })));
  return {
    shared, hasShared: shared.length > 0, sharedCount: shared.length === 1 ? '1 time' : shared.length + ' times',
    canEdit, viewOnly: !canEdit,
    isQuotes: on(v.qv && v.qv.quotesShow), isPrev: on(v.qv && v.qv.prevShow),
    tabs: tabs.map((t) => ({ ...t, amtCls: t.amt === 'Unsaved' ? '-unsaved' : '', pick: () => { t.pick(); reveal(); } })),
    chipsShow: canEdit || !isNew,
    addShow: canEdit && on(v.addTabShow),
    isNew, isLive, isManual: !isNew && !isLive, dirty, editing, adding, form, summary,
    emptyRo: isNew && !canEdit,
    card,
    canStartEdit: canEdit && summary && !isLive,
    editLabel: hasAmt ? 'Edit quote' : 'Fill in this quote',
    editCls: hasAmt ? '' : '-primary',
    startEdit: () => { ctx.set({ mQuotesEdit: key }); toTop(); },
    closeEdit,
    cmpShow, cmpCls: tone(ed.cmpFg),
    ncbShow, ncbCls: tone(ed.ncbFg), ncbAsk: ncbShow && canEdit && on(ed.ncbActShow), ncbPlain: ncbShow && !(canEdit && on(ed.ncbActShow)),
    toClaims: (e: any) => { v.toClaims(e); ctx.set({ mTab: 'cust', mCustJump: Date.now() }); },
    // form
    formTitle: adding ? 'New quote' : ed.title,
    otherShow: on(ed.otherShow), getLiveShow: adding && on(ed.getLiveShow),
    getLive: (e: any) => { ed.getLive(e); closeEdit(); reveal(); },
    srcIdle: form && !busy && !done && !bad, srcNew: adding && on(ed.bigShow), srcSmall: editing && on(ed.smallShow),
    busy, done, bad,
    pasteOpen, pasteStr: pasteOpen ? 'true' : 'false',
    togglePaste: () => ctx.set({ mQuotesPaste: pasteOpen ? null : key }),
    aiShow, aiInForm: aiShow && form, aiInCard: aiShow && summary && canEdit, aiRo: aiShow && summary && !canEdit && !ed.aiChecked,
    tickAndSave,
    hasTotal: !!total,
    save, saveOff: ed.saveCant ? '-off' : '',
    saveLabel: adding ? 'Add this quote' : (dirty ? 'Save quote' : 'No changes yet'),
    cancelNewShow: adding && on(ed.cancelNewShow),
    cancelNew: () => { ed.cancelNew(); closeEdit(); reveal(); },
    addTab: () => { v.addTab(); reveal(); toTop(); },
    discard: () => { ed.discard(); closeEdit(); },
    discardShow: editing && dirty, closeShow: editing && !dirty,
    // coupons
    cpShow: canEdit && !form, cpOpen: on(v.cpOpenShow),
    cpOpts: cpList.map((o) => ({ ...o, expOn: on(o.expShow) })),
    cpRo: !canEdit && !v.cpNoneOn,
    // sending
    // a view-only lead without quotes has nothing to send and nothing to add: no bar
    sendShow: !form && !(isNew && !canEdit), sendTap, sendLabel: 'Send this quote on WhatsApp', sendOff: send.cant ? '-off' : '',
    sendCant: !!send.cant, cantLine, sendOk: !send.cant && !on(send.warnShow), warn: on(send.warnShow),
    barNote: editing && !!send.cant,
    // previous policy
    ppKnown: on(pp.knownShow), ppUnknown: on(pp.unknownShow),
    ppCopied: on(pp.iconDone), ppCopyText: on(pp.iconDone) ? 'Copied' : 'Copy',
    ppFile: on(pp.fileShow), ppNoFile: on(pp.noFileShow),
    ppCmp: on(pp.cmpShow), ppCmpCls: tone(pp.cmpFg),
  };
}
