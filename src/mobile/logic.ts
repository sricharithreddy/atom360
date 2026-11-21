// Phone layer on top of the board's logic.
// The board's Component stays the single source of business rules. This subclass only adds
// what a phone needs: a few extra state keys, derived values under `m`, Back-button handling,
// scroll and focus management, and a toast that is visible wherever the user is.
/* eslint-disable @typescript-eslint/no-explicit-any */
import today from './vals/today';
import filters from './vals/filters';
import leadSummary from './vals/lead-summary';
import leadQuotes from './vals/lead-quotes';
import leadCustomer from './vals/lead-customer';
import outcome from './vals/outcome';
import message from './vals/message';
import stats from './vals/stats';
import learn from './vals/learn';
import admin from './vals/admin';
import adminMessages from './vals/admin-messages';
import alerts from './vals/alerts';
import leadHistory from './vals/lead-history';

/** Phones and small tablets get the phone layout; the desktop board needs about 900 px. */
export const MOBILE_QUERY = '(max-width: 899px)';

/** What a section's values file receives besides the board's values. */
export interface MobileCtx {
  /** The Component instance (state lives on `self.state`). */
  self: any;
  /** Same as self.setState. Board-locked keys still obey the board's edit lock. */
  set: (patch: any) => void;
  /** Show a short message at the bottom of the screen. */
  note: (text: string) => void;
  /** True when a board "display" string means visible ('flex', 'block', 'grid'...), false for 'none' or empty. */
  shown: (display: any) => boolean;
  /** Fresh board values (after a state change inside a handler). */
  fresh: () => any;
  /** Ask before something that cannot be undone. `run` is called only if the user agrees. */
  confirm: (q: { title: string; body: string; yes: string; danger?: boolean; run: () => void }) => void;
}

/** A section may return `layers`: full-screen pages or sheets that the Back button should close. */
export interface Layer { id: string; open: boolean; close: () => void }

type Section = (v: any, ctx: MobileCtx) => any;
const SECTIONS: Record<string, Section> = {
  today, filters, sum: leadSummary, quotes: leadQuotes, cust: leadCustomer, out: outcome,
  msg: message, stats, learn, admin, admMsg: adminMessages, alerts, hist: leadHistory,
};

const shown = (d: any) => d != null && d !== '' && d !== 'none' && d !== false;
const TOAST_MS = 4500;
const TAP_GUARD_MS = 450;

function shellVals(v: any, ctx: MobileCtx) {
  const { self, set } = ctx;
  const s = self.state;
  const view = shown(v.st && v.st.show) ? 'stats' : shown(v.ln && v.ln.show) ? 'learn' : shown(v.adm && v.adm.show) ? 'admin' : 'today';
  const isLead = !!v.detailOpen;
  const tab: string = s.mTab || 'sum';
  const sheet: string | null = s.mSheet || null;
  const call = s.cs || null;
  const liveHere = !!(call && call.st === 'live' && call.k === s.sel);
  const endedHere = !!(call && call.st === 'ended' && call.k === s.sel);
  const liveElsewhere = !!(call && call.st === 'live' && !(isLead && call.k === s.sel));
  const titles: Record<string, string> = { today: 'Today', stats: 'Stats', learn: 'Learn', admin: 'Admin' };
  const toast = s.mToast || s.toast || '';
  const leadTab = (id: string, label: string) => ({ id, label, on: tab === id, cur: tab === id ? 'true' : 'false', pick: () => set({ mTab: id }) });
  const closeSheet = () => set({ mSheet: null });
  const pickMe = (e: any) => {
    // The board ignores a role switch while someone else's lead is selected (its edit lock).
    // Closing the lead first moves the selection back to the user's own queue.
    const val = e.target.value;
    if (call && call.st === 'live') { set({ mSheet: null, mToast: 'You are on a call. End it or record the outcome before switching.' }); return; }
    v.closeDetail();
    ctx.fresh().me.pick({ target: { value: val } });
    set({ mSheet: null, mTab: 'sum' });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };
  // Dock buttons ignore taps for a moment after the buttons under the thumb have changed (see afterRender).
  const calm = (fn: (e?: any) => void) => (e?: any) => { if (Date.now() < (self.__m.guard || 0)) return; fn(e); };
  const otherLive = !!(call && call.st === 'live' && call.k !== s.sel);
  const nav = (go: (e?: any) => void) => (e?: any) => { go(e); if (typeof window !== 'undefined') window.scrollTo(0, 0); };
  return {
    view, title: titles[view],
    isToday: view === 'today', isStats: view === 'stats', isLearn: view === 'learn', isAdmin: view === 'admin',
    todayCur: view === 'today' ? 'page' : 'false', statsCur: view === 'stats' ? 'page' : 'false',
    learnCur: view === 'learn' ? 'page' : 'false', adminCur: view === 'admin' ? 'page' : 'false',
    goToday: nav(v.nav.today), goStats: nav(v.nav.stats), goLearn: nav(v.nav.learn), goAdmin: nav(v.nav.admin),
    hasAdmin: shown(v.adm && v.adm.navShow), learnDot: shown(v.nav.learnDot),
    // lead page
    isLead, leadTab: tab, tabSum: tab === 'sum', tabQuotes: tab === 'quotes', tabCust: tab === 'cust',
    leadTabs: [leadTab('sum', 'Overview'), leadTab('quotes', 'Quotes'), leadTab('hist', 'History'), leadTab('cust', 'Customer')],
    tabHist: tab === 'hist',
    toSum: () => set({ mTab: 'sum' }), toQuotes: () => set({ mTab: 'quotes' }), toCust: () => set({ mTab: 'cust' }), toHist: () => set({ mTab: 'hist' }),
    // call state for the lead page action bar
    liveHere, endedHere, idleHere: !liveHere && !endedHere, liveElsewhere,
    callBlocked: v.callBg === '#8A93B3',
    liveText: call && call.k === s.sel ? 'On call with ' + (v.sel ? v.sel.name : 'a customer') : ((v.co && v.co.otherText) || 'You are on a call.'),
    backToCall: () => { if (call) self.setState({ view: 'today', sel: call.k, open: true, exposed: call.k, unm: { m: false, e: false }, msg: null, mSheet: null, mTab: 'sum' }); },
    // sheets owned by the shell
    menuOpen: sheet === 'menu', searchOpen: sheet === 'search', outOpen: sheet === 'outcome' && isLead, alertsOpen: sheet === 'alerts',
    openAlerts: () => set({ mSheet: 'alerts' }),
    filterOn: Number(v.fCount) > 0,
    filterAria: Number(v.fCount) > 0 ? 'Filters, ' + v.fCount + ' on' : 'Filters',
    // Stats, Learn and Admin live in the menu (no bottom tabs: the queue gets the whole screen)
    menuNav: [
      { id: 'today', label: 'Today', sub: 'Your lead queue', go: () => { set({ mSheet: null }); nav(v.nav.today)(); }, cur: view === 'today' ? 'page' : 'false', dot: '' },
      { id: 'stats', label: 'Stats', sub: 'Targets, calls and the leaderboard', go: () => { set({ mSheet: null }); nav(v.nav.stats)(); }, cur: view === 'stats' ? 'page' : 'false', dot: '' },
      { id: 'learn', label: 'Learn', sub: 'Coaching, playbook and lessons', go: () => { set({ mSheet: null }); nav(v.nav.learn)(); }, cur: view === 'learn' ? 'page' : 'false', dot: shown(v.nav.learnDot) ? 'New' : '' },
    ].concat(shown(v.adm && v.adm.navShow) ? [{ id: 'admin', label: 'Admin', sub: 'Team, targets, rules and messages', go: () => { set({ mSheet: null }); nav(v.nav.admin)(); }, cur: view === 'admin' ? 'page' : 'false', dot: '' }] : []),
    openMenu: () => set({ mSheet: 'menu' }), openSearch: () => set({ mSheet: 'search' }),
    openOut: () => set({ mSheet: 'outcome' }), closeSheet, closeOut: closeSheet,
    closeSearch: () => { if (s.q) v.srch.clear(); set({ mSheet: null }); },
    searchHas: shown(v.srch.show), searchNone: shown(v.srch.show) && shown(v.srch.none),
    pickMe,
    demoAi: () => { v.me.demoAi(); set({ mSheet: null, mToast: 'Demo: the AI call marked the next lead as qualified.' }); },
    // search works from every tab: go to Today first, because a lead only shows there
    results: (v.srch.results || []).map((r: any) => ({ ...r, open: () => { if (view !== 'today') self.setState({ view: 'today' }); r.open(); set({ mSheet: null, mTab: 'sum' }); } })),
    // the Call button says why when the board would silently ignore the tap
    call: calm(() => {
      if (v.callBg === '#8A93B3') { ctx.note(v.callLabel + '. Calling is blocked for this lead.'); return; }
      if (otherLive) { ctx.confirm({ title: 'End your other call?', body: ((v.co && v.co.otherText) || 'You are still on a call.') + ' Calling ' + (v.sel ? v.sel.name : 'this customer') + ' ends it, and its outcome stays not logged.', yes: 'End it and call', run: () => ctx.fresh().startCall() }); return; }
      v.startCall();
    }),
    outNc: calm(() => { v.pickNc(); set({ mSheet: 'outcome' }); }),
    outConn: calm(() => { v.pickConn(); set({ mSheet: 'outcome' }); }),
    endCall: calm(() => v.co.endCall()),
    dockOut: calm(() => set({ mSheet: 'outcome' })),
    dockWa: calm(() => (self.__mv && self.__mv.m.msg && self.__mv.m.msg.openWa ? self.__mv.m.msg.openWa() : v.panelWa())),
    dockMail: calm(() => (self.__mv && self.__mv.m.msg && self.__mv.m.msg.openMail ? self.__mv.m.msg.openMail() : v.panelMail())),
    // confirm dialog
    confirmOpen: !!s.mConfirm, confirmTitle: s.mConfirm ? s.mConfirm.title : '', confirmBody: s.mConfirm ? s.mConfirm.body : '',
    confirmYesText: s.mConfirm ? s.mConfirm.yes : '', confirmCls: s.mConfirm && s.mConfirm.danger ? '-danger-fill' : '-primary',
    confirmNo: () => { self.__m.run = null; set({ mConfirm: null }); },
    confirmYes: () => { const run = self.__m.run; self.__m.run = null; set({ mConfirm: null }); if (run) run(); },
    callOffCls: v.callBg === '#8A93B3' ? '-off' : '',
    // toast
    toast, toastOn: !!toast, toastOff: () => set({ mToast: '', toast: '' }),
  };
}

function layersOf(v: any, m: any, self: any): Layer[] {
  const set = (p: any) => self.setState(p);
  // bottom to top
  const base: Layer[] = [
    { id: 'lead', open: !!m.isLead, close: () => v.closeDetail() },
    { id: 'filters', open: !!v.fOpen, close: () => v.toggleFilters() },
    { id: 'outcome', open: !!m.outOpen, close: () => set({ mSheet: null }) },
  ];
  const extra: Layer[] = [];
  Object.keys(SECTIONS).forEach((k) => { const ls = m[k] && m[k].layers; if (Array.isArray(ls)) ls.forEach((l: Layer) => extra.push(l)); });
  const top: Layer[] = [
    { id: 'message', open: !!v.msgOpen, close: () => (m.msg && m.msg.close ? m.msg.close() : v.mg && v.mg.close ? v.mg.close() : set({ msg: null })) },
    { id: 'search', open: !!m.searchOpen, close: () => m.closeSearch() },
    { id: 'alerts', open: !!m.alertsOpen, close: () => set({ mSheet: null }) },
    { id: 'menu', open: !!m.menuOpen, close: () => set({ mSheet: null }) },
    { id: 'confirm', open: !!m.confirmOpen, close: () => m.confirmNo() },
  ];
  return base.concat(extra, top);
}

/** Wraps the board's Component with the phone layer. Nothing here runs on the desktop layout. */
export function withMobile(Base: any): any {
  return class Mobile extends Base {
    constructor(props: any) {
      super(props);
      const self: any = this;
      self.__m = { hist: 0, sel: null, tab: null, view: null, top: null, toast: '', timer: null, bound: false, on: false, run: null, place: null, depth: 0, callKey: '', guard: 0, back: [], leaving: false };
    }

    renderVals() {
      const self: any = this;
      const v = super.renderVals();
      if (!self.__alt) { self.__mv = null; return v; }
      const ctx: MobileCtx = {
        self, shown,
        set: (patch: any) => self.setState(patch),
        note: (text: string) => self.setState({ mToast: text }),
        fresh: () => Base.prototype.renderVals.call(self),
        confirm: (q) => { self.__m.run = q.run; self.setState({ mConfirm: { title: q.title, body: q.body, yes: q.yes, danger: !!q.danger } }); },
      };
      const m: any = shellVals(v, ctx);
      Object.keys(SECTIONS).forEach((k) => {
        try { m[k] = SECTIONS[k](v, ctx) || {}; } catch (err) { m[k] = {}; if (typeof console !== 'undefined') console.error('mobile values failed: ' + k, err); }
      });
      m.layers = layersOf(v, m, self);
      self.__mv = { v, m };
      return { ...v, m };
    }

    afterRender() {
      const self: any = this;
      if (super.afterRender) super.afterRender();
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const st = self.__m, root = document.documentElement;
      if (!self.__alt || !self.__mv) {
        if (st.on) { st.on = false; root.classList.remove('m-on', 'm-lock'); }
        return;
      }
      const { v, m } = self.__mv;
      // The desktop-only quote dialog has no phone form (quotes are edited inside the lead). Close it if it came along.
      if (v.sheetOpen) { v.closeSheet(); return; }
      if (!st.on) { st.on = true; root.classList.add('m-on'); }
      if (!st.bound) {
        st.bound = true;
        try { window.history.replaceState({ m: 0 }, ''); } catch { /* history not available */ }
        window.addEventListener('popstate', (e: PopStateEvent) => self.__mPop(e));
        window.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && self.__alt) self.__mCloseTop(); });
      }
      const open: Layer[] = m.layers.filter((l: Layer) => l.open);
      const depth = open.length;
      root.classList.toggle('m-lock', depth > 0);
      const now = Date.now();
      const s = self.state;
      const callKey = s.cs ? s.cs.k + ':' + s.cs.st : '';

      // Taps: when a sheet closes or the call state changes, the buttons under the thumb change.
      // Ignore dock taps for a moment so a double tap cannot start a call or pick an outcome.
      if (depth < st.depth || callKey !== st.callKey) st.guard = now + TAP_GUARD_MS;
      const opened = depth > st.depth;
      st.depth = depth; st.callKey = callKey;

      // Back button: one history entry for the app itself, plus one per open layer.
      const level = depth + 1;
      try {
        if (st.leaving) { /* the user is leaving the app */ }
        else if (level > st.hist) { for (let n = st.hist + 1; n <= level; n++) window.history.pushState({ m: n }, ''); st.hist = level; }
        else if (level < st.hist) { const d = level - st.hist; st.hist = level; window.history.go(d); }
      } catch { /* ignore */ }

      // A closed lead forgets its tab and its outcome sheet, so the next lead opens on Overview.
      if (!m.isLead && ((s.mTab && s.mTab !== 'sum') || s.mSheet === 'outcome')) { self.setState({ mTab: 'sum', mSheet: s.mSheet === 'outcome' ? null : s.mSheet }); return; }
      // A message belongs to the screen it was shown on: drop an old one when the user moves on or opens a sheet.
      const place = m.view + '|' + (m.isLead ? 'lead' : '');
      const moved = st.place != null && st.place !== place;
      st.place = place;
      if ((moved || opened) && m.toast && m.toast === st.toast) { self.setState({ mToast: '', toast: '' }); return; }
      // Scroll: a new lead or a new tab starts at the top.
      if (m.isLead && (st.sel !== s.sel || st.tab !== m.leadTab)) {
        const el = document.querySelector('[data-m-scroll="lead"]');
        if (el) el.scrollTop = 0;
      }
      st.sel = m.isLead ? s.sel : null; st.tab = m.leadTab;

      // Focus: keep it inside the top layer, and give it back when the layer closes.
      const topId = depth ? open[depth - 1].id : null;
      document.querySelectorAll('.m-bar, .m-main, .m-tabbar, .m-callstrip').forEach((el) => { (el as any).inert = depth > 0; });
      document.querySelectorAll('[data-m-layer]').forEach((el) => { (el as any).inert = el.getAttribute('data-m-layer') !== topId; });
      if (topId !== st.top) {
        const act = document.activeElement as HTMLElement | null;
        if (opened && act && act !== document.body) st.back.push(act);
        st.top = topId;
        const el = topId ? (document.querySelector('[data-m-layer="' + topId + '"]') as HTMLElement | null) : null;
        if (!opened) {
          const prev = st.back.pop() as HTMLElement | undefined;
          if (prev && document.contains(prev) && !(prev as any).closest('[inert]')) prev.focus({ preventScroll: true });
          else if (el) el.focus({ preventScroll: true });
          if (!depth) st.back = [];
        } else if (el && !(act && el.contains(act))) {
          const auto = el.querySelector('[data-m-autofocus]') as HTMLElement | null;
          (auto || el).focus({ preventScroll: true });
        }
      } else if (topId && document.activeElement === document.body) {
        // the focused button was replaced (Call became End, and so on)
        const el = document.querySelector('[data-m-layer="' + topId + '"]') as HTMLElement | null;
        if (el) el.focus({ preventScroll: true });
      }

      // Toast: the board never clears its own, so clear it after a few seconds.
      if (m.toast !== st.toast) {
        st.toast = m.toast;
        if (st.timer) { clearTimeout(st.timer); st.timer = null; }
        if (m.toast) st.timer = setTimeout(() => { st.timer = null; if ((self.state.mToast || self.state.toast || '') === st.toast) self.setState({ mToast: '', toast: '' }); }, TOAST_MS);
      }
    }

    __mCloseTop() {
      const self: any = this;
      if (!self.__mv) return false;
      const open: Layer[] = self.__mv.m.layers.filter((l: Layer) => l.open);
      if (!open.length) return false;
      open[open.length - 1].close();
      return true;
    }

    __mPop(e: PopStateEvent) {
      const self: any = this;
      const st = self.__m;
      const want = e.state && typeof e.state.m === 'number' ? e.state.m : 0;
      // On the desktop layout only remember where history is, so the phone layout can square up later.
      if (!self.__alt || !self.__mv) { st.hist = want; return; }
      let depth = self.__mv.m.layers.filter((l: Layer) => l.open).length;
      st.hist = want;
      if (want === 0 && depth === 0) {
        // Back with nothing open. Never lose a live call; from another tab go home first; otherwise leave.
        const s = self.state, m = self.__mv.m;
        if (s.cs && s.cs.st === 'live') { self.setState({ mToast: 'You are on a call. End it or record the outcome first.' }); return; }
        if (m.view !== 'today') { m.goToday(); return; }
        // Inside the demo phone frame there is nothing to leave to: stay on Today.
        if (window.self !== window.top) { self.setState({}); return; }
        st.leaving = true;
        try { window.history.back(); } catch { /* ignore */ }
        setTimeout(() => { st.leaving = false; self.setState({}); }, 800); // nowhere to go back to: stay
        return;
      }
      // Back: close layers from the top until the screen matches the history entry.
      let guard = 8;
      while (depth + 1 > want && depth > 0 && guard-- > 0) {
        if (!self.__mCloseTop()) break;
        self.renderVals(); // state changed synchronously; recompute before counting again
        const now = self.__mv ? self.__mv.m.layers.filter((l: Layer) => l.open).length : 0;
        if (now >= depth) break; // the layer refused to close; stop rather than loop
        depth = now;
      }
      // Forward (or a layer that would not close): history and screen disagree, afterRender squares them.
      if (depth + 1 !== want) self.setState({});
    }
  };
}
