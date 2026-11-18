import type { MobileCtx } from '../logic';

/** Phone-only values for the Admin screen (m.admin.*): Team, Targets and rules, Activity.
 *  Nothing here changes a rule. It derives real booleans from the board's display strings, adds the
 *  "are you sure" step before the two actions that are hard to take back (marking someone as left,
 *  moving leads) and says what happened afterwards. All writes go through the board's own handlers. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const list = (x: any): any[] => (Array.isArray(x) ? x : []);
const picked = (opts: any) => list(opts).find((o: any) => o.on) || {};
const count = (n: any, single: string, many: string) => String(n) + ' ' + (String(n) === '1' ? single : many);
const STATUS_TAG: Record<string, string> = { Active: '-green', 'On leave': '-orange', Left: '-magenta' };

export default function (v: any, ctx: MobileCtx): any {
  const adm = v.adm || {};
  const s = ctx.self.state || {};
  /** The board locks Targets and rules for a team lead with CSS only; its handlers do not check the role. */
  const isAdmin = adm.lockPe === 'auto';
  const freshAdm = () => (ctx.fresh().adm || {});
  const lastLog = () => { const top = list(freshAdm().log)[0]; return top ? String(top.t) : ''; };

  // ---- tabs: the strip scrolls at 360 px, so bring the tapped tab fully into view ----
  const tabs = list(adm.tabs).map((t: any) => ({
    ...t,
    pick: (e: any) => {
      t.pick();
      const el = e && e.currentTarget;
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    },
  }));

  // ---- people ----
  const people = list(adm.people).map((p: any, i: number) => {
    const full = String(p.name || '');
    const you = / \(you\)$/.test(full);
    const nm = full.replace(/ \(you\)$/, '');
    const canEdit = ctx.shown(p.stShow);
    const status = canEdit ? (picked(p.stOpts).val || 'Active') : 'Active';
    const openN = canEdit ? String(p.open) : '';
    return {
      ...p, nm, you, canEdit, status,
      statusCls: STATUS_TAG[status] || '',
      hasHint: ctx.shown(p.hintShow),
      openLabel: openN === '1' ? 'open lead' : 'open leads',
      repLine: p.repText && p.repText !== '—' ? 'Reports to ' + p.repText : '',
      onSt: (e: any) => {
        const val = String(e.target.value);
        if (val === status) return;
        const apply = () => {
          const now = list(freshAdm().people)[i];
          if (!now) return;
          now.onSt({ target: { value: val } });
          ctx.note(lastLog() || 'Marked ' + nm + ' as ' + val.toLowerCase());
        };
        if (val.indexOf('Left') === 0) {
          ctx.confirm({
            title: 'Mark ' + nm + ' as left?',
            body: nm + ' will get no new leads and drops out of round robin. ' + (openN === '0' ? '' : 'Use Move leads for the ' + count(openN, 'open lead', 'open leads') + ' still with ' + nm + '. ') + 'Everyone on the team sees this change.',
            yes: 'Mark as left', danger: true, run: apply,
          });
        } else apply();
      },
      onRep: (e: any) => {
        const val = String(e.target.value);
        if (val === picked(p.repOpts).val) return;
        p.onRep({ target: { value: val } });
        ctx.note(nm + ' now reports to ' + val);
      },
    };
  });

  // ---- move leads ----
  const from = String(picked(adm.mvFrom).val || '');
  const toLabel = String(picked(adm.mvTo).label || 'To round robin').replace(/^To /, '');
  const hits = parseInt(String(adm.mvCount || '0'), 10) || 0;
  const mvOff = !!adm.mvOff;
  const mvWhy = !mvOff ? '' : hits === 0
    ? 'No open lead of ' + from + ' matches. Change who or which leads.'
    : 'Nobody else is active for round robin. Pick a person to move to.';
  const doMove = () => {
    if (mvOff) { ctx.note(mvWhy); return; }
    const what = count(hits, 'lead', 'leads');
    ctx.confirm({
      title: 'Move ' + what + '?',
      body: 'Move ' + what + ' from ' + from + ' to ' + toLabel + '? This cannot be undone in one step.',
      yes: 'Move ' + what, danger: true,
      run: () => {
        const now = freshAdm();
        if (now.mvOff || !now.doMove) { ctx.note('Nothing was moved. The leads changed while you were deciding.'); return; }
        now.doMove();
        ctx.note(lastLog() || 'Moved ' + what + ' from ' + from + ' to ' + toLabel);
      },
    });
  };

  // ---- targets and rules ----
  const rules = list(adm.allocRules).map((r: any) => {
    const hasSwitch = ctx.shown(r.togShow);
    const on = r.press === 'true';
    return { ...r, hasSwitch, on, stateText: hasSwitch ? (on ? 'On' : 'Off') : 'Always on', stateCls: !hasSwitch ? '' : on ? '-green' : '' };
  });

  // Number fields. The board clamps and saves on every keystroke, so "45" cannot be typed into a field whose
  // lowest value is 5 (the "4" snaps to 5). Keep what is being typed here and hand the board only numbers
  // inside the field's own min/max; the board's handler still does the saving and the logging.
  const drafts: Record<string, string> = s.mAdminNum || {};
  const numField = (key: string, val: any, handler: (e: any) => void) => ({
    val: key in drafts ? drafts[key] : String(val),
    on: (e: any) => {
      const el = e.target, txt = String(el.value), n = Number(txt);
      ctx.set({ mAdminNum: { ...(ctx.self.state.mAdminNum || {}), [key]: txt } });
      if (txt.trim() !== '' && Number.isInteger(n) && n >= Number(el.min) && n <= Number(el.max)) handler({ target: { value: txt } });
    },
    blur: (e: any) => {
      const now: Record<string, string> = { ...(ctx.self.state.mAdminNum || {}) };
      if (!(key in now)) return;
      const txt = now[key], n = Number(txt), el = e.target;
      delete now[key];
      ctx.set({ mAdminNum: now });
      if (!(txt.trim() !== '' && Number.isInteger(n) && n >= Number(el.min) && n <= Number(el.max))) ctx.note('Enter a whole number from ' + el.min + ' to ' + el.max + '. Kept ' + String(val) + '.');
    },
  });
  const tgRows = list(adm.tgRows).map((r: any) => ({ ...r, polN: numField('pol' + r.name, r.pol, r.onPol), callsN: numField('calls' + r.name, r.calls, r.onCalls) }));
  const aiOn = list(adm.aiFirst).filter((a: any) => a.checked).map((a: any) => a.label);

  return {
    isAdmin, isLead: !isAdmin,
    tabs,
    people,
    mvOff, mvWhy, hasMvWhy: !!mvWhy, mvHas: hits > 0, doMove,
    rules, tgRows,
    capN: numField('cap', adm.cap, adm.onCap), aiDaysN: numField('aiDays', adm.aiDays, adm.onAiDays),
    escDaysN: numField('escDays', adm.escDays, adm.onEscDays), cbMinN: numField('cbMin', adm.cbMin, adm.onCbMin),
    aiFirstText: aiOn.length ? aiOn.join(', ') : 'No lead type',
    capText: count(adm.cap, 'lead', 'leads'),
    aiDaysText: count(adm.aiDays, 'day', 'days'),
    escDaysText: count(adm.escDays, 'day', 'days'),
    cbMinText: count(adm.cbMin, 'minute', 'minutes'),
    /** Number fields snap to their lowest value when emptied, so select the old number on focus: typing replaces it. */
    selAll: (e: any) => { const el = e && e.target; if (el && el.select) { try { el.select(); } catch { /* not selectable */ } } },
    logEmpty: list(adm.log).length === 0,
  };
}
