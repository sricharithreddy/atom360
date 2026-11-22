import type { MobileCtx } from '../logic';
import { INSURERS, LEAD_TYPES, NCBS, emptyPolicy, sampleScan, normReg, regOk, digits, fmtDate, type Policy } from '../added';

/** Add a policy (m.add.*): scan a policy copy or type it in. Saved policies show on Today under "Added by you". */
/* eslint-disable @typescript-eslint/no-explicit-any */
export default function (v: any, ctx: MobileCtx): any {
  const self: any = ctx.self;
  const s = self.state;
  const a = s.mAdd || null;
  const list: Policy[] = s.mAdded || [];
  if (!a) {
    return {
      open: false,
      start: () => ctx.set({ mAdd: { step: 'choose' }, mSheet: null }),
      layers: [{ id: 'add-policy', open: false, close: () => ctx.set({ mAdd: null }) }],
    };
  }
  const f: Policy = a.f || emptyPolicy();
  const set = (patch: any) => ctx.set({ mAdd: { ...a, ...patch } });
  const field = (k: keyof Policy, clean?: (t: string) => string) => (e: any) => {
    const val = e && e.target ? String(e.target.value) : '';
    set({ f: { ...f, [k]: clean ? clean(val) : val } });
  };

  // ---- scan: the file is only used for its name here; the sample version fills plausible figures
  const onScan = (e: any) => {
    const file = e && e.target && e.target.files ? e.target.files[0] : null;
    if (!file) return;
    const thumb = /^image\//.test(file.type || '') && typeof URL !== 'undefined' ? URL.createObjectURL(file) : '';
    const n = (self.__mAddScans = (self.__mAddScans || 0) + 1);
    ctx.set({ mAdd: { step: 'reading', file: file.name, thumb } });
    setTimeout(() => {
      const cur = self.state.mAdd;
      if (!cur || cur.step !== 'reading') return; // closed while reading
      ctx.set({ mAdd: { step: 'form', mode: 'new', f: sampleScan(file.name, n - 1), thumb, tried: false } });
    }, 1400);
  };

  // ---- checks
  const err: Record<string, string> = {};
  if (!f.name.trim()) err.name = 'Enter the customer’s name.';
  if (digits(f.mobile).length !== 10) err.mobile = 'Enter a 10-digit mobile number.';
  if (!f.reg.trim()) err.reg = 'Enter the registration number.';
  else if (!regOk(f.reg)) err.reg = 'Check the format, for example TS09 AB 1234.';
  if (f.chassis && f.chassis.replace(/\s/g, '').length !== 17) err.chassis = 'A chassis number has 17 characters.';
  if (!f.odEnd) err.odEnd = 'Enter when the policy ends.';
  if (f.ptype === 'OD only' && !f.tpEnd) err.tpEnd = 'Enter when third party cover ends.';
  if (f.insurer === 'Other' && !f.insurerOther.trim()) err.insurerOther = 'Enter the insurer’s name.';
  const tried = !!a.tried;
  const shown = (k: string) => (tried && err[k] ? err[k] : '');
  const nErr = Object.keys(err).length;

  // ---- same vehicle already a lead?
  const reg = normReg(f.reg);
  const known: { name: string; reg: string }[] = [];
  (v.groups || []).forEach((g: any) => (g.cards || []).forEach((c: any) => known.push({ name: String(c.name).replace(/ \(\+1 car\)$/, ''), reg: c.reg })));
  list.filter((p) => p.id !== f.id).forEach((p) => known.push({ name: p.name, reg: p.reg }));
  const dup = reg ? known.filter((k) => normReg(k.reg) === reg)[0] : null;

  const dirty = a.step === 'form' && (a.mode === 'new' ? JSON.stringify(f) !== JSON.stringify(emptyPolicy()) : JSON.stringify(f) !== JSON.stringify(list.filter((p) => p.id === f.id)[0] || {}));
  const close = () => {
    if (!dirty) { ctx.set({ mAdd: null }); return; }
    ctx.confirm({ title: 'Discard this policy?', body: 'What you entered is not saved.', yes: 'Discard', danger: true, run: () => ctx.set({ mAdd: null }) });
  };

  const save = () => {
    if (nErr) { set({ tried: true }); ctx.note(nErr === 1 ? 'One detail needs a look.' : nErr + ' details need a look.'); return; }
    const clean: Policy = { ...f, reg, chassis: f.chassis.replace(/\s/g, '').toUpperCase(), engine: f.engine.trim().toUpperCase(), mobile: digits(f.mobile).replace(/^(\d{5})(\d{5})$/, '$1 $2') };
    const doSave = () => {
      const now = self.state.mAdded || [];
      if (a.mode === 'edit') ctx.set({ mAdded: now.map((p: Policy) => (p.id === clean.id ? clean : p)), mAdd: null, mToast: 'Saved changes for ' + clean.name + '.' });
      else ctx.set({ mAdded: [{ ...clean, id: 'p' + Date.now() }].concat(now), mAdd: null, mQuick: 'all', view: 'today', mToast: clean.name + ' added to Today under “Added by you”.' });
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    };
    if (dup && a.mode !== 'edit') {
      ctx.confirm({ title: 'This vehicle is already a lead', body: reg + ' belongs to ' + dup.name + '. Add it again anyway?', yes: 'Add anyway', run: doSave });
      return;
    }
    doSave();
  };
  const remove = () => ctx.confirm({
    title: 'Remove ' + (f.name || 'this policy') + '?', body: 'It leaves your Today list.', yes: 'Remove', danger: true,
    run: () => ctx.set({ mAdded: (self.state.mAdded || []).filter((p: Policy) => p.id !== f.id), mAdd: null, mToast: 'Removed.' }),
  });

  const opt = (list2: string[], cur: string) => list2.map((x) => ({ val: x, label: x, on: x === cur }));
  return {
    open: true,
    choose: a.step === 'choose', reading: a.step === 'reading', form: a.step === 'form',
    title: a.step === 'form' ? (a.mode === 'edit' ? f.name || 'Policy' : f.scanned ? 'Check the scanned details' : 'Add a policy') : 'Add a policy',
    file: a.file || f.file || '', thumb: a.thumb || '', hasThumb: !!a.thumb,
    scanned: !!f.scanned && a.mode !== 'edit', isEdit: a.mode === 'edit',
    onScan, manual: () => set({ step: 'form', mode: 'new', f: emptyPolicy(), tried: false }), back: () => set({ step: 'choose' }),
    close, save, remove, saveLabel: a.mode === 'edit' ? 'Save changes' : 'Add to Today',
    f, ptypes: (['OD+TP', 'OD only', 'TP only'] as const).map((t) => ({ label: t === 'OD+TP' ? 'OD + TP' : t, on: f.ptype === t ? 'true' : 'false', pick: () => set({ f: { ...f, ptype: t } }) })),
    odOnly: f.ptype === 'OD only', otherIns: f.insurer === 'Other',
    insOpts: [{ val: '', label: 'Choose the insurer', on: !f.insurer }].concat(opt(INSURERS, f.insurer)),
    ncbOpts: opt(NCBS, f.ncb).map((o) => ({ ...o, label: o.val + '%' })),
    typeOpts: opt(LEAD_TYPES, f.leadType),
    odEndText: f.odEnd ? fmtDate(f.odEnd) : '',
    on: {
      name: field('name'), mobile: field('mobile', (t) => t.replace(/[^\d ]/g, '').slice(0, 11)), reg: field('reg', (t) => t.toUpperCase()),
      model: field('model'), chassis: field('chassis', (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17)), engine: field('engine', (t) => t.toUpperCase()),
      insurer: field('insurer'), insurerOther: field('insurerOther'), polNo: field('polNo'), odEnd: field('odEnd'), tpEnd: field('tpEnd'),
      ncb: field('ncb'), idv: field('idv', (t) => t.replace(/\D/g, '').slice(0, 8)), leadType: field('leadType'),
      regBlur: () => { if (f.reg && regOk(f.reg)) set({ f: { ...f, reg: normReg(f.reg) } }); },
    },
    err: { name: shown('name'), mobile: shown('mobile'), reg: shown('reg'), chassis: shown('chassis'), odEnd: shown('odEnd'), tpEnd: shown('tpEnd'), insurerOther: shown('insurerOther') },
    chassisN: f.chassis.length + ' of 17',
    dup: dup ? 'Already a lead: ' + dup.name + ' has ' + reg + '.' : '', hasDup: !!dup,
    layers: [{ id: 'add-policy', open: true, close }],
  };
}
