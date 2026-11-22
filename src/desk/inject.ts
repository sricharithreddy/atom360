// Desktop parity: puts the features that started on the phone into the desktop board's template.
// The board file stays as designed; each part goes in at a named anchor. If a new board moves an
// anchor, injectDesk reports it (and the contract test fails), instead of silently dropping a feature.
// Parts reuse the phone's own markup where it fits, inside `.m-app.m-desk` so the phone styles apply.
import today from '../mobile/tpl/today.html?raw';
import leadQuotes from '../mobile/tpl/lead-quotes.html?raw';
import leadCustomer from '../mobile/tpl/lead-customer.html?raw';
import adminSponsor from '../mobile/tpl/admin-sponsor.html?raw';
import adminMove from '../mobile/tpl/admin-move.html?raw';
import managerCoupons from '../mobile/tpl/manager-coupons.html?raw';
import addPolicy from '../mobile/tpl/add-policy.html?raw';
import quoteCard from '../mobile/tpl/quote-card.html?raw';
import datacheck from '../mobile/tpl/datacheck.html?raw';

/** The text between `start` (included) and the matching end tag of its element. */
function cut(src: string, start: string, tag: string): string {
  const i = src.indexOf(start);
  if (i < 0) throw new Error('desk part not found: ' + start);
  const open = new RegExp('<' + tag + '[\\s>]', 'g'), close = '</' + tag + '>';
  let depth = 0, at = i;
  for (;;) {
    open.lastIndex = at;
    const o = open.exec(src), c = src.indexOf(close, at);
    if (c < 0) throw new Error('desk part not closed: ' + start);
    if (o && o.index < c) { depth++; at = o.index + 1; } else { depth--; at = c + close.length; if (depth === 0) return src.slice(i, at); }
  }
}
const wrap = (cls: string, html: string) => '<div class="m-app m-desk ' + cls + '">' + html + '</div>';

const card = cut(today, '<li class="m-card -nopad m-today-card', 'li').replace('<li ', '<div ').replace(/<\/li>$/, '</div>');
const shared = cut(leadQuotes, '<section class="m-card -nopad m-qshare"', 'section');
const profile = cut(leadCustomer, '<section class="m-card -nopad m-cust-card" aria-labelledby="mcuP">', 'section');
const CHEV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17h14M6 17l1.5-5.5A2 2 0 0 1 9.4 10h5.2a2 2 0 0 1 1.9 1.5L18 17"></path></svg>';

interface Rule { name: string; anchor: string | RegExp; at: 'before' | 'after' | 'replace' | 'afterLine' | 'beforeLine'; html: string | ((m: string) => string) }

const RULES: Rule[] = [
  { name: 'header: Scan policy', anchor: /<button type="button" (style="[^"]*">Scan policy<\/button>)/, at: 'replace', html: (m) => m.replace('<button type="button" ', '<button type="button" onClick="{{ m.add.start }}" ') },
  { name: 'header: New enquiry', anchor: /<button type="button" (style="[^"]*">\+ New enquiry<\/button>)/, at: 'replace', html: (m) => m.replace('<button type="button" ', '<button type="button" onClick="{{ m.add.manual }}" ') },
  { name: 'rail: Data check', anchor: '{{ nav.admin }}', at: 'afterLine', html: '<sc-if value="{{ m.mgr.isTeam }}"><button type="button" class="dk-rail" onClick="{{ m.mgr.dc.start }}">' + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"></path><path d="M4 10h16M10 10v10"></path><path d="M14 14l2 2 3-4"></path></svg>Data</button></sc-if>' },
  { name: 'queue: stage filter', anchor: '<sc-for list="{{ tabs }}"', at: 'afterLine', html: '' }, // placeholder, filled below
  { name: 'queue: added by you', anchor: '<sc-for list="{{ groups }}"', at: 'before', html: '<sc-if value="{{ m.dk.hasAdded }}">' + wrap('dk-added', '<div class="dk-added-h"><strong>Added by you</strong><span>{{ m.dk.addedCount }}</span></div><div class="dk-added-grid"><sc-for list="{{ m.dk.added }}" as="card">' + card + '</sc-for></div>') + '</sc-if>\n' },
  { name: 'card: sponsored tag', anchor: '{{ c.srcLine }}</span>', at: 'after', html: '<sc-if value="{{ c.dSponsor }}"><span class="dk-spon">Sponsored</span></sc-if>' },
  { name: 'quotes: share history', anchor: 'SENDING</span>', at: 'beforeLine', html: wrap('dk-inline dk-shared', shared) + '\n' },
  { name: 'quotes: quote card button', anchor: '<button type="button" disabled="{{ send.cant }}" onClick="{{ send.open }}"', at: 'before', html: '<button type="button" class="dk-qcard" onClick="{{ m.qcard.start }}">Quote card</button>' },
  { name: 'customer: profile', anchor: '<h3 id="cu35"', at: 'afterLine', html: wrap('dk-inline dk-profile', profile) + '\n' },
  { name: 'records: service tab', anchor: '<sc-for list="{{ recTabs }}"', at: 'afterLine', html: '<button type="button" role="tab" class="dk-svc-tab" aria-selected="{{ m.dk.recSvcSel }}" onClick="{{ m.dk.toSvc }}">Service<span class="dk-svc-n">{{ m.hist.segs.1.n }}</span></button>\n' },
  { name: 'records: service pane', anchor: '<sc-if value="{{ recIsDocs }}"', at: 'before', html: '<sc-if value="{{ m.dk.recSvc }}">' + wrap('dk-inline dk-svc', '<sc-if value="{{ m.hist.hasVisits }}"><p class="m-small m-hist-sum">{{ m.hist.svcSummary }}</p><ol class="m-hist-tl"><sc-for list="{{ m.hist.visits }}" as="sv"><li class="m-hist-row"><span class="m-hist-ic -svc {{ sv.cls }}" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"></path></svg></span><div class="m-hist-body"><div class="m-inline -between -top"><p class="m-hist-t">{{ sv.kind }}</p><strong class="m-fixed m-num m-hist-amt">{{ sv.amt }}</strong></div><p class="m-tiny">{{ sv.when }} · {{ sv.km }} · {{ sv.by }}</p><sc-if value="{{ sv.hasNote }}"><p class="m-hist-note">{{ sv.note }}</p></sc-if></div></li></sc-for></ol></sc-if><sc-if value="{{ m.hist.hasVisits }}" not><p class="m-empty">No visits to our workshop. This customer services the car elsewhere.</p></sc-if>') + '</sc-if>\n' },
  { name: 'admin: move by insurer or year', anchor: '{{ adm.rulesShow }}', at: 'beforeLine', html: '<sc-if value="{{ adm.teamShow }}" eq="flex">' + wrap('dk-inline dk-admin', adminMove) + '</sc-if>\n' },
  { name: 'admin: sponsored insurer', anchor: '{{ adm.rulesShow }}', at: 'afterLine', html: wrap('dk-inline dk-admin', adminSponsor) + '\n' },
  { name: 'stats: coupons by caller', anchor: '{{ st.leadsShow }}', at: 'beforeLine', html: '<sc-if value="{{ st.overShow }}" eq="flex">' + wrap('dk-inline dk-stats', managerCoupons) + '</sc-if>\n' },
];
RULES[3].html = '<label class="dk-stage"><span>Stage</span><select onChange="{{ m.dk.onStage }}"><sc-for list="{{ m.dk.stageOpts }}" as="so"><option value="{{ so.val }}" selected="{{ so.on }}">{{ so.label }}</option></sc-for></select></label>\n';
void CHEV;

/** Dialogs and notes the desktop needs, after the board's own markup. */
const OVERLAYS = wrap('dk-overlays', addPolicy + quoteCard + datacheck + `
<sc-if value="{{ m.confirmOpen }}">
<div class="m-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dcfT" aria-describedby="dcfB">
<button type="button" class="m-backdrop" aria-label="Cancel" onClick="{{ m.confirmNo }}"></button>
<div class="m-dialog-card" data-m-layer="confirm" tabindex="-1">
<h2 class="m-h2" id="dcfT">{{ m.confirmTitle }}</h2>
<p class="m-body" id="dcfB">{{ m.confirmBody }}</p>
<div class="m-inline" style="margin-top: 8px"><button type="button" class="m-btn -grow" onClick="{{ m.confirmNo }}">Cancel</button><button type="button" class="m-btn -grow {{ m.confirmCls }}" onClick="{{ m.confirmYes }}">{{ m.confirmYesText }}</button></div>
</div>
</div>
</sc-if>
<sc-if value="{{ m.noteOn }}">
<div class="m-toast" role="status" aria-live="polite"><span>{{ m.note }}</span><button type="button" aria-label="Dismiss" onClick="{{ m.noteOff }}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div>
</sc-if>`);

export interface InjectResult { template: string; missing: string[] }

export function injectDesk(board: string): InjectResult {
  let out = board;
  const missing: string[] = [];
  for (const r of RULES) {
    const m = typeof r.anchor === 'string' ? (out.indexOf(r.anchor) >= 0 ? { index: out.indexOf(r.anchor), text: r.anchor } : null)
      : (() => { const x = r.anchor.exec(out); return x ? { index: x.index, text: x[0] } : null; })();
    if (!m) { missing.push(r.name); continue; }
    const html = typeof r.html === 'function' ? r.html(m.text) : r.html;
    if (r.at === 'replace') out = out.slice(0, m.index) + html + out.slice(m.index + m.text.length);
    else if (r.at === 'before') out = out.slice(0, m.index) + html + out.slice(m.index);
    else if (r.at === 'after') { const e = m.index + m.text.length; out = out.slice(0, e) + html + out.slice(e); }
    else if (r.at === 'beforeLine') { const s = out.lastIndexOf('\n', m.index) + 1; out = out.slice(0, s) + html + out.slice(s); }
    else { let e = out.indexOf('\n', m.index); e = e < 0 ? out.length : e + 1; out = out.slice(0, e) + html + out.slice(e); }
  }
  return { template: out + '\n' + OVERLAYS + '\n', missing };
}
