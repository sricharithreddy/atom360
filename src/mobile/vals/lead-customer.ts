import type { MobileCtx } from '../logic';
import { PROFESSIONS, profileOf, plain, soldLabel, dobText, maskMobile, showMobile, maskEmail } from '../profile';

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
  // History has its own tab on the lead page; Records keeps documents, claims and coupons.
  const histSel = !!v.recIsHist;
  const tabs = (v.recTabs || []).filter((t: any) => t.label !== 'History').map((t: any) => {
    const has = ctx.shown(t.countShow), n = String(t.count);
    const extra = !has ? '' : t.label === 'Documents' ? n.replace('/', ' of ') + ' accepted' : t.label === 'Coupons' ? n + (canEdit ? ' to apply' : ' unused') : t.label === 'History' ? n + (n === '1' ? ' entry' : ' entries') : n + ' on record';
    return {
      label: t.label === 'Documents' ? 'Docs' : t.label, say: t.label + (extra ? ', ' + extra : ''),
      selected: histSel && t.label === 'Documents' ? 'true' : t.selected, pick: t.pick, count: t.count, hasCount: has, countBg: t.countBg, countFg: t.countFg,
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
    const arrived = !mem.on && mem.sel === i && rec !== mem.rec && rec === 'claims';
    if ((arrived || jump !== mem.jump) && typeof document !== 'undefined') {
      setTimeout(() => { const el = document.getElementById('rec12'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }, 140);
    }
    mem.rec = rec; mem.jump = jump; mem.sel = i;
  }
  mem.on = onTab;

  // ---- profile: sold by us or elsewhere, DOB, profession; mobile and email can be updated
  const prof = profileOf(ctx, (v.sel || {}).name);
  const pkey = plain((v.sel || {}).name);
  const pe = s.mProfEdit && s.mProfEdit.k === pkey ? s.mProfEdit : null;
  const setPe = (patch: any) => ctx.set({ mProfEdit: { ...pe, ...patch } });
  const peErr = pe && pe.tried ? {
    mobile: pe.mobile && pe.mobile.replace(/\D/g, '').length !== 10 ? 'Enter a 10-digit mobile number.' : '',
    email: pe.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pe.email) ? 'Check the email address.' : '',
  } : { mobile: '', email: '' };
  const unmM = !!(s.unm && s.unm.m), unmE = !!(s.unm && s.unm.e);
  const profSave = () => {
    if (!pe) return;
    const mob = String(pe.mobile || '').replace(/\D/g, ''), em = String(pe.email || '').trim();
    if ((pe.mobile && mob.length !== 10) || (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))) { setPe({ tried: true }); return; }
    const all = { ...(s.mProfile || {}) };
    const before = profileOf(ctx, pkey);
    all[pkey] = { ...(all[pkey] || {}), dob: pe.dob, prof: pe.prof, ...(mob ? { mobile: mob } : {}), ...(em ? { email: em } : {}) };
    // a changed mobile or email goes into History, so a number cannot be swapped without a trace
    const who = (/Signed in as ([^,]+)/.exec(String((v.me && v.me.label) || '')) || [])[1] || 'You';
    const notes: string[] = [];
    if (mob && mob !== before.mobile) notes.push('Mobile number updated');
    if (em && em !== before.email) notes.push('Email updated');
    const patch: any = { mProfile: all, mProfEdit: null, mToast: 'Customer details saved.' };
    if (notes.length) {
      const hadd = { ...(s.hadd || {}) }, k = s.sel;
      hadd[k] = [{ when: 'Today 1:10 pm', by: who, t: notes.join(' · '), msg: true }].concat(hadd[k] || []);
      patch.hadd = hadd;
    }
    ctx.set(patch);
  };

  return {
    prof: {
      soldText: soldLabel(prof), soldUs: prof.sold === 'us', soldCls: prof.sold === 'us' ? '-green' : '', soldAt: prof.sold === 'us' ? prof.soldAt : 'Vehicle bought from another dealer',
      dob: dobText(prof.dob) || 'Not added', prof: prof.prof || 'Not added',
      editing: !!pe, edit: () => ctx.set({ mProfEdit: { k: pkey, mobile: '', email: '', dob: prof.dob, prof: prof.prof, tried: false } }),
      cancel: () => ctx.set({ mProfEdit: null }), save: profSave,
      f: pe || { mobile: '', email: '', dob: '', prof: '' },
      on: {
        mobile: (e: any) => setPe({ mobile: String(e.target.value).replace(/[^\d ]/g, '').slice(0, 11) }),
        email: (e: any) => setPe({ email: String(e.target.value).trim() }),
        dob: (e: any) => setPe({ dob: e.target.value }),
        prof: (e: any) => setPe({ prof: e.target.value }),
      },
      profOpts: [{ val: '', label: 'Choose', on: !(pe && pe.prof) }].concat(PROFESSIONS.map((x) => ({ val: x, label: x, on: !!pe && pe.prof === x }))),
      err: peErr,
    },
    // contact rows show an updated number or email (masked the same way until revealed)
    mobileText: prof.mobile ? (unmM ? showMobile(prof.mobile) : maskMobile(prof.mobile)) : v.mobileText,
    emailText: prof.email ? (unmE ? prof.email : maskEmail(prof.email)) : v.emailText,
    mobileNew: !!prof.mobile, emailNew: !!prof.email,
    isDocs: !!v.recIsDocs || histSel,
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
