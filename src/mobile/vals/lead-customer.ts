import type { MobileCtx } from '../logic';

/** Customer tab of the lead page: contact, language, address and the Records block.
 *  Thin by design: real booleans from the board's display strings, handlers wrapped with feedback. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (v: any, ctx: MobileCtx): any {
  const self = ctx.self;
  const s = self.state || {};
  const i = s.sel;
  const ow = v.ow || {}, ct = v.ct || {}, ad = v.ad || {};
  const canEdit = ow.pe !== 'none' && ctx.shown(ow.ctlShow);

  // ---- contact
  const exposed = ctx.shown(v.contactShow);
  const stop = (s.dnc || {})[i];
  const blocked = !exposed && (stop === 'all' || stop === 'num');
  const altDraft: string = ct.altDraft || '';
  const altReady = altDraft.length === 10;
  const altEditing = canEdit && ctx.shown(ct.altEditShow);
  const lang = (ct.langOpts || []).filter((o: any) => o.on).map((o: any) => o.label)[0] || '';

  // ---- records
  const tabs = (v.recTabs || []).map((t: any) => {
    const has = ctx.shown(t.countShow), n = String(t.count);
    const extra = !has ? '' : t.label === 'Documents' ? n.replace('/', ' of ') + ' accepted' : t.label === 'Coupons' ? n + ' to apply' : t.label === 'History' ? n + (n === '1' ? ' entry' : ' entries') : n + ' on record';
    return {
      label: t.label === 'Documents' ? 'Docs' : t.label, say: t.label + (extra ? ', ' + extra : ''),
      selected: t.selected, pick: t.pick, count: t.count, hasCount: has, countBg: t.countBg, countFg: t.countFg,
    };
  });
  const addOpen = canEdit && ctx.shown(v.addDocShow);
  const docs = (v.docRows || []).map((d: any) => ({
    name: d.name, status: d.status, chipBg: d.chipBg, chipFg: d.chipFg,
    // The board writes "Link sent on WhatsApp" although nothing is sent. Say what is true.
    note: d.status === 'Requested' ? 'Waiting for the customer to send it' : d.note,
  }));
  const hist = (v.histRows || []).map((h: any) => ({ when: h.when, by: h.by, t: h.t, meta: h.meta, bg: h.bg, fg: h.fg }));
  const coupons = (v.cpnRows || []).map((c: any) => ({
    name: c.name, note: c.note, status: c.status, chipBg: c.chipBg, chipFg: c.chipFg,
    canApply: canEdit && ctx.shown(c.applyShow),
    apply: () => { c.apply(); ctx.note(c.name + ' applied to the quote. Remove it from the Quotes tab.'); },
  }));
  const claimAsked = (v.claimOpts || []).some((o: any) => o.press === 'true');

  // ---- arriving from "Record the answer" (Quotes) or "See history" (Overview): bring Records into view.
  // Other sections may set `mCustJump: Date.now()`; a changed Records tab while away counts too.
  const onTab = !!v.detailOpen && s.mTab === 'cust';
  const rec = v.recIsDocs ? 'docs' : v.recIsClaims ? 'claims' : v.recIsCpn ? 'cpn' : 'hist';
  const mem = self.__mCust || (self.__mCust = { on: false, rec: 'hist', jump: 0, sel: null });
  if (onTab) {
    const jump = s.mCustJump || 0;
    const arrived = !mem.on && mem.sel === i && rec !== mem.rec && (rec === 'claims' || rec === 'hist');
    if ((arrived || jump !== mem.jump) && typeof document !== 'undefined') {
      setTimeout(() => { const el = document.getElementById('rec12'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }, 140);
    }
    mem.rec = rec; mem.jump = jump; mem.sel = i;
  }
  mem.on = onTab;

  return {
    canEdit,
    // contact
    exposed, hidden: !exposed && !blocked, blocked,
    hiddenWhy: canEdit ? 'They show here once you call, WhatsApp or email this customer.' : 'They show here once you WhatsApp or email this customer.',
    blockedWhy: stop === 'num' ? 'Marked as a wrong number. Calls and messages are stopped, so the number and email stay hidden.' : 'The customer asked for no calls and no messages, so the number and email stay hidden.',
    mMasked: ctx.shown(v.mIconShow), eMasked: ctx.shown(v.eIconShow),
    altHas: ct.altBtn === 'Change', altEditing, altShowBtn: canEdit && !altEditing,
    altBtnSay: ct.altBtn === 'Change' ? 'Change alternate number' : 'Add alternate number',
    altSaveCls: altReady ? '-primary' : '-off', altOff: altReady ? 'false' : 'true',
    altLeft: altReady ? '' : (altDraft.length ? (10 - altDraft.length) + ' more ' + (10 - altDraft.length === 1 ? 'digit' : 'digits') + ' to go.' : 'Enter all 10 digits.'),
    altSave: () => { if (altReady) ct.altSave(); else ctx.note('An alternate number has 10 digits.'); },
    lang,
    // address
    adHas: ad.editLabel === 'Edit', adEditing: canEdit && ctx.shown(ad.editShow), adView: !(canEdit && ctx.shown(ad.editShow)),
    adErr: ctx.shown(ad.errShow), adInvalid: ctx.shown(ad.errShow) ? 'true' : 'false',
    // records
    tabs, docs, hist, coupons,
    histEmpty: ctx.shown(v.histEmptyShow), claimNone: ctx.shown(v.claimNoneShow), claimAsked,
    addOpen, addBtn: canEdit && !addOpen, docCustom: ctx.shown(v.docCustomShow),
    addCls: v.cantAddDoc ? '-off' : '-primary', addOff: v.cantAddDoc ? 'true' : 'false',
    addRequest: () => {
      if (v.cantAddDoc) { ctx.note('Type the name of the document first.'); return; }
      v.addDocRequest();
      ctx.note('Added to the list as Requested');
    },
  };
}
