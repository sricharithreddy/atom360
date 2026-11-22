import type { MobileCtx } from '../logic';
import { leadRows, yearOf } from '../leadinfo';

/** Admin additions from dealer feedback (m.adx.*): a sponsored insurer whose leads go first, and moving
 *  leads by insurer or renewal year. Phone layer, sample version. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const CALLERS = ['Anitha', 'Harsha', 'Meghana'];
const YEARS = [['any', 'Any year'], ['5-7', '5th to 7th year'], ['1-4', '1st to 4th year']].concat([1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), ['1st', '2nd', '3rd'][n - 1] ? ['1st', '2nd', '3rd'][n - 1] + ' year' : n + 'th year']));

export default function (v: any, ctx: MobileCtx): any {
  const s = ctx.self.state;
  const isAdmin = (v.adm || {}).lockPe === 'auto';
  const show = s.view === 'admin' || !!s.mAdxNeed;
  const rows = show ? leadRows(ctx) : [];
  const insurers = Array.from(new Set(rows.map((r) => r.ins).filter(Boolean))).sort();

  // ---- sponsored insurer
  const sponsor: string = s.mSponsor || '';
  const sponsorN = rows.filter((r) => r.ins === sponsor).length;
  const sponsorOpts = [{ val: '', label: 'None', on: !sponsor }].concat(insurers.map((x) => ({ val: x, label: x, on: x === sponsor })));
  const onSponsor = (e: any) => {
    const val = e && e.target ? String(e.target.value) : '';
    ctx.set({ mSponsor: val, mToast: val ? val + ' leads now go first for every caller.' : 'No sponsored insurer. Leads follow the normal priority.' });
  };

  // ---- move leads by insurer or renewal year
  const mv = s.mMove || { from: 'any', ins: 'any', yr: 'any', to: '' };
  const setMv = (patch: any) => ctx.set({ mMove: { ...mv, ...patch } });
  const yrOk = (r: any) => { const y = yearOf(r.ren); if (mv.yr === 'any') return true; if (mv.yr === '5-7') return y >= 5 && y <= 7; if (mv.yr === '1-4') return y >= 1 && y <= 4; return String(y) === mv.yr; };
  const match = rows.filter((r) => (mv.from === 'any' || r.owner === mv.from) && (mv.ins === 'any' || r.ins === mv.ins) && yrOk(r) && (!mv.to || r.owner !== mv.to));
  const opt = (list: string[][], cur: string) => list.map((x) => ({ val: x[0], label: x[1], on: x[0] === cur }));
  const canMove = !!mv.to && match.length > 0;
  const doMove = () => {
    if (!mv.to) { ctx.note('Choose who gets the leads.'); return; }
    if (!match.length) { ctx.note('No leads match. Change the filters.'); return; }
    ctx.confirm({
      title: 'Move ' + match.length + (match.length === 1 ? ' lead' : ' leads') + ' to ' + mv.to + '?',
      body: match.map((r) => r.name).join(', ') + '. The sale counts for ' + mv.to + ' from now on.',
      yes: 'Move ' + (match.length === 1 ? 'lead' : 'leads'),
      run: () => { const own = { ...(ctx.self.state.own || {}) }; match.forEach((r) => { own[r.k] = mv.to; }); ctx.set({ own, mToast: match.length + (match.length === 1 ? ' lead' : ' leads') + ' moved to ' + mv.to + '.' }); },
    });
  };

  return {
    isAdmin,
    sponsor, sponsorOn: !!sponsor, sponsorOpts, onSponsor,
    sponsorLine: sponsor ? sponsorN + (sponsorN === 1 ? ' lead was' : ' leads were') + ' insured with ' + sponsor + ' last year. They go to the top of every caller’s list, with a Sponsored tag and higher priority.' : 'When an insurer sponsors the calling, its renewal leads can go first for every caller.',
    mv: {
      fromOpts: opt([['any', 'Anyone']].concat(CALLERS.map((c) => [c, c])), mv.from),
      insOpts: opt([['any', 'Any insurer']].concat(insurers.map((x) => [x, x])), mv.ins),
      yrOpts: opt(YEARS, mv.yr),
      toOpts: [{ val: '', label: 'Choose a caller', on: !mv.to }].concat(CALLERS.map((c) => ({ val: c, label: c, on: c === mv.to }))),
      on: { from: (e: any) => setMv({ from: e.target.value }), ins: (e: any) => setMv({ ins: e.target.value }), yr: (e: any) => setMv({ yr: e.target.value }), to: (e: any) => setMv({ to: e.target.value }) },
      count: match.length === 1 ? '1 lead matches' : match.length + ' leads match', names: match.map((r) => r.name + ' (' + (r.ins || 'insurer not known') + ', ' + (r.ren || 'year not known') + ', now ' + r.owner + ')').join(' · '),
      hasNames: match.length > 0, btn: canMove ? 'Move ' + match.length + (match.length === 1 ? ' lead' : ' leads') + ' to ' + mv.to : 'Move leads', off: canMove ? '' : '-off',
      doMove,
    },
  };
}
