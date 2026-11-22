import type { MobileCtx } from '../logic';
import { logShare } from '../shares';

const TAP_GUARD_MS = 500;
const SEND_HOLD_MS = 400;

/** Phone-only values for the message composer, available in the template as m.msg.* */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (v: any, ctx: MobileCtx): any {
  const self = ctx.self;
  const s = self.state;
  const mg = v.mg || {};
  const open = !!v.msgOpen;
  const msg = open ? s.msg : null;
  // Touch guards (phone only): remember when the composer opened and whether a send is on its way.
  const ui: any = self.__mMsgUi || (self.__mMsgUi = { open: false, at: 0, timer: null });
  if (open && !ui.open) ui.at = Date.now();
  ui.open = open;
  const busy = open && !!s.mMsgBusy;
  const isWa = !msg || msg.ch === 'wa';

  // Has the caller changed the text? The board keeps `text: null` until the first keystroke, so while it is
  // null the value on screen is the generated one. Remember it, so typing and then undoing is not "edited".
  const mem: any = self.__mMsg || (self.__mMsg = { key: '', text: '', subj: '' });
  if (msg) {
    const key = [msg.k, msg.ch, msg.tpl].join('|');
    if (mem.key !== key) { mem.key = key; mem.text = null; mem.subj = null; }
    if (msg.text == null) mem.text = mg.text;
    if (msg.subj == null) mem.subj = mg.subj;
  }
  const textEdited = !!msg && msg.text != null && msg.text !== mem.text;
  const subjEdited = !!msg && !isWa && msg.subj != null && msg.subj !== mem.subj;
  const edited = textEdited || subjEdited;

  // Messages stop for "wrong number" and for "stop calls and messages". The board only checks this where
  // the composer is opened from the lead header, so the phone says it wherever it matters.
  const dnc = s.dnc ? s.dnc[s.sel] : null;
  const blocked = dnc === 'all' || dnc === 'num';
  const blockedWhy = dnc === 'num'
    ? 'This number is marked wrong. Messages stop until the correct number is added.'
    : dnc === 'all' ? 'The customer asked for no calls and no messages.' : '';
  const blockedNote = 'Messages are off for this lead. ' + blockedWhy;

  const text = String(mg.text == null ? '' : mg.text);
  const empty = !text.trim();
  const noSubj = !isWa && !String(mg.subj == null ? '' : mg.subj).trim();
  const chars = text.length;

  const close = () => {
    if (!edited) { mg.close(); return; }
    ctx.confirm({
      title: 'Discard this message?',
      body: 'Your changes to the message will be lost. Nothing has been sent.',
      yes: 'Discard', danger: true,
      run: () => ctx.fresh().mg.close(),
    });
  };

  const onTpl = (e: any) => {
    const val = e && e.target ? e.target.value : '';
    if (!val) return;
    if (!edited) { mg.onTpl({ target: { value: val } }); return; }
    const label = ((mg.tplOpts || []).find((o: any) => o.id === val) || {}).label || 'the new template';
    ctx.confirm({
      title: 'Replace your message?',
      body: 'Switching to "' + label + '" replaces the text you edited.',
      yes: 'Replace text',
      run: () => ctx.fresh().mg.onTpl({ target: { value: val } }),
    });
  };

  // Back to the template's own wording: the board does this when a template is picked.
  const reset = () => { if (msg) mg.onTpl({ target: { value: msg.tpl } }); };

  const send = () => {
    if (blocked) { ctx.note(blockedNote); return; }
    if (empty) { ctx.note('The message is empty. Write something or pick a template.'); return; }
    if (noSubj) { ctx.note('Add a subject before you send the email.'); return; }
    // The dock's WhatsApp and Email buttons sit where Send appears, and Send sits where the dock's
    // Call button reappears. Ignore the second tap of a double tap on the way in, and hold the
    // composer for a moment on the way out so that tap lands here and not on Call.
    if (busy || Date.now() - ui.at < TAP_GUARD_MS) return;
    ctx.set({ mMsgBusy: true });
    if (ui.timer) clearTimeout(ui.timer);
    ui.timer = setTimeout(() => {
      ui.timer = null;
      const st = self.state;
      const same = !!st.msg && !!msg && st.msg.k === msg.k && st.msg.ch === msg.ch;
      // an older note must not hide the board's "sent" confirmation
      ctx.set(st.mToast ? { mMsgBusy: false, mToast: '' } : { mMsgBusy: false });
      if (same) {
        // a quote sent as text goes into the quote share log, with its channel, insurer and price
        if (st.msg.tpl === 'quote') logShare(ctx, ctx.fresh(), 'Text', st.msg.ch === 'mail' ? 'Email' : 'WhatsApp');
        ctx.fresh().mg.send();
      }
    }, SEND_HOLD_MS);
  };
  // Opening the composer drops an older phone note, which would sit over its title.
  const openCh = (go: () => void) => () => {
    if (blocked) { ctx.note(blockedNote); return; }
    if (s.mToast) ctx.set({ mToast: '' });
    go();
  };

  const cantSend = blocked || empty || noSubj;
  return {
    isWa, isMail: !isWa,
    edited, blocked, blockedWhy,
    hasWarn: ctx.shown(mg.warnShow), hasLangNote: ctx.shown(mg.langNoteShow),
    count: chars + (chars === 1 ? ' character' : ' characters'),
    sendCls: cantSend ? '-off' : (isWa ? '-wa' : '-primary'),
    sendOff: cantSend || busy ? 'true' : 'false',
    sendText: busy ? 'Sending…' : mg.sendLabel,
    close, onTpl, reset, send,
    // For the entry points (owned by the shell and other sections): same as panelWa / panelMail,
    // but a tap on a lead with messages switched off says why instead of doing nothing.
    waOff: blocked, waOffCls: blocked ? '-off' : '',
    openWa: openCh(() => v.panelWa()),
    openMail: openCh(() => v.panelMail()),
  };
}
