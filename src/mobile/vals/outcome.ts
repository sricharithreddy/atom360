import type { MobileCtx } from '../logic';

/** Phone-only values for the Call outcome sheet, available in the template as m.out.*.
 *  Business rules stay in the board (v.co): this file only turns display strings into booleans,
 *  reshapes lists for touch buttons and wraps Save (confirm, then close the sheet). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (v: any, ctx: MobileCtx): any {
  const co = v.co || {};
  const ow = v.ow || {};
  const s = ctx.self.state;
  const on = ctx.shown;
  const canEdit = on(ow.ctlShow);

  // The draft the board is using for this lead (read only; all writes go through board handlers).
  const oc = s.oc && s.oc.k === s.sel ? s.oc : null;
  const step = oc ? oc.s1 : null;
  const outId: string | null = step === 'conn' && oc ? oc.out || null : null;
  const reasons: any[] = (co.ddOpts || []).map((o: any) => ({
    label: o.label, press: o.on ? 'true' : 'false',
    pick: () => co.onDd({ target: { value: o.val } }),
  }));
  const reason = ((co.ddOpts || []).find((o: any) => o.on) || {}).label || '';

  const tones: Record<string, string> = { 'Close this lead': '-close' };
  const opts = (co.opts || []).map((o: any) => ({ label: o.label, effect: o.effect, press: o.press, pick: o.pick, cls: tones[o.label] || '' }));
  const picked = (co.opts || []).find((o: any) => o.press === 'true');

  const live = on(co.liveShow), ended = on(co.endedShow), blocked = on(co.blockShow);
  const hasWhen = on(co.whenShow);
  // "Mon 9 Nov · 10:00 am · calls 8 am to 6 pm" -> "Mon 9 Nov, 10:00 am"
  const whenShort = hasWhen ? String(co.whenText || '').split(' · ').slice(0, 2).join(', ') : '';

  // One short line above Save: what will be written.
  let sum = '';
  if (!co.cantSave) {
    sum = (step === 'nc' ? 'Not connected' : picked ? picked.label : '') + ' · ' + reason + (whenShort ? ' · next call ' + whenShort : '');
  }

  // Choices that cannot be undone in the app: ask first, naming what happens.
  const isLost = outId === 'lost';
  const ask = !isLost ? null
    : on(co.dncShow) ? { title: 'Stop calls to this customer?', yes: 'Stop calls' }
      : on(co.wrongShow) ? { title: 'Mark this number as wrong?', yes: 'Mark wrong' }
        : { title: 'Close this lead?', yes: 'Close lead' };
  const name = v.sel && v.sel.name ? String(v.sel.name) : 'this lead';

  const doSave = () => {
    const f = ctx.fresh();
    if (!f.co || f.co.cantSave) return;
    f.co.saveNext();
    // The board has moved on to the next lead; show it from the top.
    ctx.set({ mSheet: null, mTab: 'sum' });
  };
  const save = () => {
    if (co.cantSave) return;
    if (ask) {
      ctx.confirm({ title: ask.title, body: name + ': ' + co.effect + ' This cannot be undone here.', yes: ask.yes, danger: true, run: doSave });
      return;
    }
    doSave();
  };

  return {
    canEdit, viewOnly: !canEdit,
    live, ended, blocked, ready: !live && !ended && !blocked,
    other: on(co.otherShow), pend: on(co.pendShow),
    backToCall: () => { co.backToCall(); ctx.set({ mSheet: null, mTab: 'sum' }); },
    noPick: on(co.pickHint), conn: on(co.connShow),
    opts,
    hasReason: on(co.ddShow), reasons,
    elseOn: on(co.elseShow), soldOn: on(co.soldShow), wrongOn: on(co.wrongShow), dncOn: on(co.dncShow),
    dncOpts: (co.dncOpts || []).map((o: any) => ({ label: o.label, press: o.press, pick: o.pick })),
    linkOn: on(co.linkShow), linkEmpty: on(co.linkEmptyShow), linkHas: on(co.linkCopyShow),
    linkCls: on(co.linkEmptyShow) ? '-empty' : '',
    hasWhen,
    quick: (co.quick || []).map((o: any) => ({ label: o.label, sub: o.sub, press: o.press, pick: o.pick })),
    hasEffect: on(co.effectShow), hasNote: on(co.noteShow), manual: on(co.manualShow), attr: canEdit && on(ow.attrShow),
    irreversible: !!ask,
    canSave: !co.cantSave, sum, saveCls: co.cantSave ? '-off' : ask ? '-danger-fill' : '-primary',
    cantSave: !!co.cantSave,
    saveWhy: step === 'conn' ? 'Pick what happened on the call to save.' : 'Pick Connected or Not connected to save.',
    endsCall: live && !co.cantSave,
    save,
    close: () => ctx.set({ mSheet: null }),
  };
}
