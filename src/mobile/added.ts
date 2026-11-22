// Policies added on the phone (typed in, or read from a scanned policy copy).
// They live in phone state until a backend exists; the board's sample leads are fixed data.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MobileCtx } from './logic';
import { copyText } from './copy';

/** The board's demo clock is 8 Nov 2026; days to expiry are counted from it so added leads line up. */
export const DEMO_TODAY = '2026-11-08';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const INSURERS = ['Bajaj Allianz', 'Cholamandalam', 'Digit', 'HDFC ERGO', 'ICICI Lombard', 'New India', 'SBI General', 'Tata AIG', 'Acko', 'Other'];
export const LEAD_TYPES = ['Walk-in enquiry', 'Own renewal', 'From service', 'From sales', 'Winback', 'Other data'];
export const NCBS = ['0', '20', '25', '35', '45', '50'];

export interface Policy {
  id: string; name: string; mobile: string; reg: string; model: string; chassis: string; engine: string;
  insurer: string; insurerOther: string; polNo: string; ptype: 'OD+TP' | 'OD only' | 'TP only';
  odEnd: string; tpEnd: string; ncb: string; idv: string; leadType: string; scanned: boolean; file: string;
}

export const emptyPolicy = (): Policy => ({
  id: '', name: '', mobile: '', reg: '', model: '', chassis: '', engine: '', insurer: '', insurerOther: '', polNo: '',
  ptype: 'OD+TP', odEnd: '', tpEnd: '', ncb: '0', idv: '', leadType: 'Walk-in enquiry', scanned: false, file: '',
});

/** What a scan returns in this sample version: fixed, plausible figures (the real build reads the copy). */
export function sampleScan(file: string, n: number): Policy {
  const set = [
    { name: 'Srinivas Reddy', mobile: '98490 12345', reg: 'TS07 FK 2286', model: 'Creta SX', chassis: 'MALC381CRPM912384', engine: 'G4LCEM918273', insurer: 'HDFC ERGO', polNo: '2312203456789012', ptype: 'OD+TP', odEnd: '2026-12-14', tpEnd: '2026-12-14', ncb: '25', idv: '940000' },
    { name: 'Meera Iyer', mobile: '99120 44871', reg: 'TS09 EM 7140', model: 'Venue SX', chassis: 'MALC381CRPM633190', engine: 'G4LCEM661205', insurer: 'ICICI Lombard', polNo: '3001/2025/88412', ptype: 'OD only', odEnd: '2026-11-29', tpEnd: '2028-11-29', ncb: '20', idv: '720000' },
  ][n % 2];
  return { ...emptyPolicy(), ...set, ptype: set.ptype as Policy['ptype'], leadType: 'Walk-in enquiry', scanned: true, file };
}

export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1] : '';
}
export function daysTo(iso: string): number | null {
  const a = Date.parse(DEMO_TODAY + 'T00:00:00Z'), b = Date.parse((iso || '') + 'T00:00:00Z');
  return isNaN(b) ? null : Math.round((b - a) / 86400000);
}
const minusYear = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return ''; const d = new Date(Date.UTC(+m[1] - 1, +m[2] - 1, +m[3] + 1)); return d.toISOString().slice(0, 10); };

export const insurerOf = (p: Policy) => (p.insurer === 'Other' ? p.insurerOther.trim() || 'Other insurer' : p.insurer);
export const digits = (t: string) => String(t || '').replace(/\D/g, '');
export function normReg(t: string): string {
  const s = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(s);
  return m ? [m[1] + m[2].padStart(2, '0'), m[3], m[4].padStart(4, '0')].filter(Boolean).join(' ') : String(t || '').toUpperCase().trim();
}
export const regOk = (t: string) => /^[A-Z]{2}\d{2}( [A-Z]{1,3})? \d{4}$/.test(normReg(t));

/** Added policies shaped like the Today cards, so they use the same card layout. */
export function addedCards(ctx: MobileCtx): any[] {
  const s = ctx.self.state;
  const list: Policy[] = s.mAdded || [];
  const copied = s.mCopied || '';
  return list.map((p) => {
    const days = daysTo(p.odEnd);
    const expired = days != null && days < 0;
    const insurer = insurerOf(p);
    const cover = p.odEnd
      ? (p.ptype === 'OD only' ? 'OD ' + fmtDate(minusYear(p.odEnd)) + ' – ' + fmtDate(p.odEnd) + (p.tpEnd ? ' · TP till ' + fmtDate(p.tpEnd) : '')
        : fmtDate(minusYear(p.odEnd)) + ' – ' + fmtDate(p.odEnd))
      : 'Expiry date not given';
    const prio = days == null ? 2 : expired || days <= 7 ? 4 : days <= 15 ? 3 : 2;
    const rows = [['Reg no', p.reg], ['Chassis no', p.chassis], ['Engine no', p.engine]].filter((r) => r[1]).map((r) => {
      const id = 'add:' + p.id + ':' + r[0];
      return { k: r[0], v: r[1], copied: copied === id, label: 'Copy ' + r[0].toLowerCase() + ' ' + r[1], copy: () => copyText(ctx, r[1], r[0] + ' copied', id) };
    });
    const vehOpen = !!((s.mCardVeh || {})['add:' + p.id]);
    const tel = digits(p.mobile);
    return {
      added: true, id: p.id, daysNum: days,
      moodCls: '-none', moodSay: 'New lead',
      stars: [1, 2, 3, 4, 5].map((n) => ({ cls: n <= prio ? '-on' : '' })), prio, prioLabel: 'Priority ' + prio + ' of 5',
      name: p.name || 'New customer', model: p.model || 'Vehicle', reg: p.reg || 'No reg no',
      rtypeText: p.ptype === 'OD+TP' ? 'OD + TP' : p.ptype, rtypeCls: p.ptype === 'OD only' ? '-od' : p.ptype === 'TP only' ? '-tp' : '-both',
      leadType: p.leadType + (insurer ? ' · ' + insurer : ''), hasLeadType: true,
      cover, coverKnown: !!p.odEnd,
      tags: [{ text: p.scanned ? 'Scanned' : 'Added', cls: '-blue', ai: false }], hasTags: true, hasMeta: true,
      summary: expired ? 'Policy expired ' + -days + (days === -1 ? ' day' : ' days') + ' ago · inspection may be needed' : 'New · not contacted yet', hasSummary: true, boxTime: '', late: '', pulseCls: '',
      hasQuote: false, quoteIns: '', quoteAmt: '',
      vehOpen, vehOpenStr: vehOpen ? 'true' : 'false', vrows: rows,
      toggleVeh: () => { const all = { ...(ctx.self.state.mCardVeh || {}) }; all['add:' + p.id] = !vehOpen; ctx.set({ mCardVeh: all }); },
      live: false, blocked: !tel, ready: !!tel, callText: tel ? 'Call' : 'No mobile', callCls: tel ? '-primary' : '-off',
      callAria: tel ? 'Call ' + (p.name || 'customer') + ' on ' + p.mobile : 'No mobile number saved',
      // Added leads are not in the call log yet, so Call opens the phone's own dialler.
      call: () => { if (!tel) { ctx.note('Add a mobile number to call.'); return; } window.location.href = 'tel:+91' + tel.slice(-10); },
      wa: () => { if (!tel) { ctx.note('Add a mobile number to message.'); return; } window.open('https://wa.me/91' + tel.slice(-10), '_blank', 'noopener'); },
      open: () => ctx.set({ mAdd: { step: 'form', mode: 'edit', f: { ...p }, tried: false } }),
    };
  });
}
