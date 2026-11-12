import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getLead, openWhatsApp, revealContact, saveOutcome, saveQuote, startCall } from '../../api/endpoints';
import { clock, dayMonth, expiryLabel, lakh, rupees, toLocalInput, whenLabel } from '../../app/format';
import { SOURCE_LABEL, type CallOutcome, type LeadDetail, type Quote } from '../../domain/types';

export function LeadPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ['lead', leadId], queryFn: () => getLead(leadId) });
  // After any change the server sends the lead back; keep it and refresh the lists behind the panel.
  const accept = (d: LeadDetail) => { qc.setQueryData(['lead', leadId], d); void qc.invalidateQueries({ queryKey: ['queue'] }); void qc.invalidateQueries({ queryKey: ['summary'] }); };
  const refresh = () => void qc.invalidateQueries({ queryKey: ['lead', leadId] });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay">
      <button type="button" className="overlay-back" aria-label="Close lead" onClick={onClose} />
      <aside className="panel" aria-label="Lead workspace">
        {isLoading && <p className="muted">Loading…</p>}
        {error && <p className="error" role="alert">{(error as Error).message}</p>}
        {data && (
          <>
            <Head d={data} onClose={onClose} onSent={refresh} />
            <Contact d={data} />
            <Facts d={data} />
            <div className="panel-grid">
              <div className="stack">
                <Quotes d={data} onSaved={accept} />
                <PrevPolicy d={data} />
              </div>
              <div className="stack">
                <CallBox d={data} onSaved={accept} onChanged={refresh} />
                <History d={data} />
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Head({ d, onClose, onSent }: { d: LeadDetail; onClose: () => void; onSent: () => void }) {
  const [menu, setMenu] = useState(false);
  const [err, setErr] = useState('');
  const c = d.card;
  const send = useMutation({ mutationFn: (t: 'reminder' | 'quote') => openWhatsApp(d.lead.id, t), onSuccess: (r) => { window.open(r.waUrl, '_blank', 'noopener'); setMenu(false); setErr(''); onSent(); }, onError: (e: Error) => setErr(e.message) });
  return (
    <header className="panel-head">
      <div className="panel-title">
        <h2>{d.customer.name}</h2>
        <p className="muted">{d.vehicle.model} · {d.vehicle.regNo} · speaks {d.customer.language} · {SOURCE_LABEL[d.lead.source]}</p>
      </div>
      <div className="menu-wrap">
        <button type="button" className="btn" disabled={!c.permissions.canMessage} aria-expanded={menu} onClick={() => setMenu(!menu)}>WhatsApp</button>
        {menu && (
          <div className="menu">
            <button type="button" onClick={() => send.mutate('reminder')}>Renewal reminder</button>
            <button type="button" onClick={() => send.mutate('quote')}>Best quote</button>
            <small>Opens WhatsApp on your own number with the message filled in.</small>
            {err && <small className="error">{err}</small>}
          </div>
        )}
      </div>
      <button type="button" className="btn btn-icon" aria-label="Close" onClick={onClose}>×</button>
      <div className="flags">
        <span className={`flag ${c.isMine ? '' : 'flag-info'}`}><b>{c.isMine ? 'Your lead' : `Owner: ${c.ownerName}`}</b>{!c.isMine && (c.permissions.canEdit ? `You can edit this lead. The sale counts for ${c.ownerName}.` : `View only. You can send WhatsApp. The sale counts for ${c.ownerName}.`)}</span>
        {c.ai.kind === 'qualified' && <span className="flag flag-ai"><b>AI qualified</b>Customer told the AI at {clock(c.ai.at)} that they want to renew.{c.isMine ? ' Call now.' : ''}</span>}
        {c.ai.kind === 'with_ai' && <span className="flag flag-ai"><b>With AI</b>No call for {c.ai.pendingDays} days, so the AI is calling too.{c.isMine ? ' You can still call.' : ''}</span>}
        {c.ai.kind === 'soon' && <span className="flag flag-warn"><b>AI calls tomorrow</b>No call for {c.ai.pendingDays} days. {c.isMine ? 'Call today, or the AI picks it up.' : 'The owner should call today.'}</span>}
        <span className="flag flag-info"><b>{d.renewedBefore}</b></span>
        {c.permissions.callBlock && c.permissions.callBlock.code !== 'not_owner' && <span className="flag flag-bad"><b>{c.permissions.callBlock.label}</b>{c.permissions.callBlock.reason}</span>}
      </div>
    </header>
  );
}

function Contact({ d }: { d: LeadDetail }) {
  const [shown, setShown] = useState<{ mobile?: string; email?: string }>({});
  const reveal = useMutation({ mutationFn: (f: 'mobile' | 'email') => revealContact(d.lead.id, f).then((r) => ({ f, v: r.value })), onSuccess: ({ f, v }) => setShown((s) => ({ ...s, [f]: v })) });
  const row = (f: 'mobile' | 'email', label: string, masked: string | null) => masked && (
    <span className="contact-item">{label} <b>{shown[f] ?? masked}</b>
      {shown[f] ? <button type="button" className="link" onClick={() => setShown((s) => ({ ...s, [f]: undefined }))}>Hide</button> : <button type="button" className="link" onClick={() => reveal.mutate(f)}>Show</button>}
    </span>
  );
  return (
    <section className="row-card" aria-label="Contact">
      {row('mobile', 'Mobile', d.customer.mobileMasked)}
      {row('email', 'Email', d.customer.emailMasked)}
      <span className="muted small">Each time a full number or email is shown, it is recorded.</span>
    </section>
  );
}

function Facts({ d }: { d: LeadDetail }) {
  const c = d.card;
  return (
    <section className="facts" aria-label="Summary">
      <p className="why-now"><small>WHY NOW</small>{d.lead.whyNow}<b>{c.ai.kind === 'qualified' ? 'Call now · customer wants to renew' : d.lead.nextCallAt ? `Next call ${whenLabel(d.lead.nextCallAt)}` : 'No call scheduled'}</b></p>
      <div className="tiles">
        <div><span>Policy ends</span><strong className={c.daysToExpiry < 0 ? 'bad' : c.daysToExpiry <= 15 ? 'warn' : ''}>{expiryLabel(c.daysToExpiry)}</strong><small>{dayMonth(d.lead.expiryDate)}</small></div>
        <div><span>Attempts</span><strong>{c.attempts.caller + c.attempts.ai || 'None'}</strong><small>AI {c.attempts.ai} · {c.isMine ? 'you' : c.ownerName} {c.attempts.caller}</small></div>
        <div><span>Best quote</span><strong>{c.bestQuote ? rupees(c.bestQuote.premium) : 'None yet'}</strong><small>{c.bestQuote ? c.bestQuote.insurer : 'Add one below'}</small></div>
        <div><span>No-claim bonus</span><strong>{d.prevPolicy?.ncbPercent != null ? `${d.prevPolicy.ncbPercent}%` : 'Not known'}</strong><small>on the last policy</small></div>
      </div>
    </section>
  );
}

const VALID = [{ m: 10, label: '10 minutes' }, { m: 30, label: '30 minutes' }, { m: 60, label: '1 hour' }, { m: 1440, label: '1 day' }];
const num = (s: string) => { const n = Number(s.replace(/[^\d]/g, '')); return s.trim() && Number.isFinite(n) ? n : null; };

function Quotes({ d, onSaved }: { d: LeadDetail; onSaved: (d: LeadDetail) => void }) {
  const [editing, setEditing] = useState<Quote | 'new' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const canEdit = d.card.permissions.canEdit;
  const linkText = (q: Quote) => {
    if (!q.paymentLink) return q.premium == null ? 'To be filled' : 'No payment link yet';
    if (!q.linkExpiresAt) return 'Link ready';
    return new Date(q.linkExpiresAt).getTime() > now ? `Link active till ${whenLabel(q.linkExpiresAt).replace('Today ', '')}` : 'Link has expired · get a new one';
  };
  return (
    <section className="card" aria-label="Quotes">
      <div className="card-head"><h3>Quotes</h3>{canEdit && !editing && <button type="button" className="link" onClick={() => setEditing('new')}>+ Add insurer</button>}</div>
      {d.quotes.length === 0 && !editing && <p className="muted">No quotes yet. Make the quote on the insurer's portal, then add the figures here.</p>}
      <ul className="quotes">
        {d.quotes.map((q) => (
          <li key={q.id}>
            <span className={`dot dot-${q.kind === 'live' ? 'live' : q.premium == null ? 'empty' : 'manual'}`} aria-hidden="true" />
            <span className="q-name"><b>{q.insurer}</b><small>{q.kind === 'live' ? 'Live price' : 'Entered by hand'}{q.addons ? ` · ${q.addons}` : ''}</small></span>
            <span className={`q-link ${q.linkExpiresAt && new Date(q.linkExpiresAt).getTime() <= now ? 'bad' : ''}`}>{linkText(q)}</span>
            <strong>{rupees(q.premium)}</strong>
            {canEdit && q.kind === 'manual' ? <button type="button" className="link" onClick={() => setEditing(q)}>Edit</button> : <span />}
          </li>
        ))}
      </ul>
      {editing && <QuoteForm leadId={d.lead.id} quote={editing === 'new' ? null : editing} onDone={(r) => { if (r) onSaved(r); setEditing(null); }} />}
      <p className="muted small">Prices and payment links are made on the insurer's portal. This screen stores them and tracks how long a link stays active.</p>
    </section>
  );
}

function QuoteForm({ leadId, quote, onDone }: { leadId: string; quote: Quote | null; onDone: (d: LeadDetail | null) => void }) {
  const [f, setF] = useState({ insurer: quote?.insurer ?? '', premium: quote?.premium?.toString() ?? '', idv: quote?.idv?.toString() ?? '', ncb: quote?.ncbPercent?.toString() ?? '', addons: quote?.addons ?? '', link: quote?.paymentLink ?? '', valid: '30' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({ mutationFn: () => saveQuote(leadId, { id: quote?.id, insurer: f.insurer, premium: num(f.premium), idv: num(f.idv), ncbPercent: num(f.ncb), addons: f.addons.trim() || null, paymentLink: f.link.trim() || null, linkValidMinutes: f.link.trim() ? Number(f.valid) : null }), onSuccess: onDone });
  return (
    <form className="form" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}>
      <div className="form-grid">
        <label>Insurance company<input value={f.insurer} onChange={set('insurer')} placeholder="Type the insurer" required /></label>
        <label>Premium incl. GST (₹)<input inputMode="numeric" value={f.premium} onChange={set('premium')} /></label>
        <label>IDV (₹)<input inputMode="numeric" value={f.idv} onChange={set('idv')} /></label>
        <label>No-claim bonus (%)<input inputMode="numeric" value={f.ncb} onChange={set('ncb')} /></label>
        <label className="span2">Add-ons included (optional)<input value={f.addons} onChange={set('addons')} placeholder="e.g. Zero dep, RSA" /></label>
        <label className="span2">Payment link<input value={f.link} onChange={set('link')} placeholder="Paste the link from the insurer's portal" /></label>
        <label>Link valid for<select value={f.valid} onChange={set('valid')} disabled={!f.link.trim()}>{VALID.map((v) => <option key={v.m} value={v.m}>{v.label}</option>)}</select></label>
      </div>
      {save.isError && <p className="error" role="alert">{(save.error as Error).message}</p>}
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={save.isPending}>{quote ? 'Save quote' : 'Add quote'}</button><button type="button" className="btn btn-quiet" onClick={() => onDone(null)}>Cancel</button></div>
    </form>
  );
}

function PrevPolicy({ d }: { d: LeadDetail }) {
  const p = d.prevPolicy;
  const period = (a: string | null, b: string | null) => (a && b ? `${dayMonth(a)} – ${dayMonth(b)}` : 'Not known');
  return (
    <section className="card" aria-label="Previous policy">
      <div className="card-head"><h3>Previous policy</h3></div>
      {!p || p.insurer === 'Not known' ? <p className="muted">No previous policy on file. Ask for the current insurer, the end date, last year's premium and any claim.</p> : (
        <dl className="kv">
          <dt>Insurer</dt><dd>{p.insurer} · {p.policyType}</dd>
          <dt>Policy number</dt><dd>{p.policyNo ?? 'Not known'}</dd>
          <dt>Own damage</dt><dd>{period(p.odStart, p.odEnd)}</dd>
          <dt>Third party</dt><dd>{period(p.tpStart, p.tpEnd)}</dd>
          <dt>Premium</dt><dd>{rupees(p.premium)}</dd>
          <dt>IDV</dt><dd>{lakh(p.idv)}</dd>
          <dt>Chassis no</dt><dd>{d.vehicle.chassisNo ?? 'Not known'}</dd>
          <dt>{d.vehicle.isElectric ? 'Motor no' : 'Engine no'}</dt><dd>{d.vehicle.engineNo ?? 'Not known'}</dd>
        </dl>
      )}
    </section>
  );
}

const CONNECTED: { id: CallOutcome; label: string; ask: string; reasons: string[]; nextMins: number | null; effect: string }[] = [
  { id: 'agreed', label: 'Agreed to renew', ask: 'Send payment by', reasons: ['Payment link', 'QR code', 'Bank details', "Dealer's own method"], nextMins: 1440, effect: 'Lead turns Hot. A follow-up call is set to check the payment.' },
  { id: 'deciding', label: 'Still deciding', ask: 'What is holding them back?', reasons: ['Comparing quotes', 'Wants a lower price', 'Will pay on a date', 'Busy, call later'], nextMins: 1440, effect: 'Lead moves to Follow-up.' },
  { id: 'call_later', label: 'Call back later', ask: 'Why not now?', reasons: ['Busy right now', 'Driving', 'In a meeting', 'Asked for another time'], nextMins: 120, effect: 'Lead comes back to your queue at the time you pick, as a promised callback.' },
  { id: 'closed', label: 'Close this lead', ask: 'Why is it closing?', reasons: ['Renewed elsewhere', 'Premium too high', 'Vehicle sold', 'Wrong number', 'Asked not to call', 'Total loss', 'Moved city'], nextMins: null, effect: 'Lead closes as Lost. It stays on file for next year.' },
];
const MISSED: { id: CallOutcome; label: string }[] = [{ id: 'no_answer', label: 'No answer' }, { id: 'switched_off', label: 'Switched off' }, { id: 'busy', label: 'Busy' }];

function CallBox({ d, onSaved, onChanged }: { d: LeadDetail; onSaved: (d: LeadDetail) => void; onChanged: () => void }) {
  const perms = d.card.permissions;
  const [params, setParams] = useSearchParams();
  const [live, setLive] = useState<{ id: string; mobile: string; t0: number } | null>(null);
  const [ended, setEnded] = useState<{ id: string | null; sec: number | null } | null>(null);
  const [tick, setTick] = useState(0);
  const [side, setSide] = useState<'yes' | 'no' | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [reason, setReason] = useState('');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');

  const dial = useMutation({ mutationFn: () => startCall(d.lead.id), onSuccess: (r) => { setLive({ id: r.call.id, mobile: r.mobile, t0: Date.now() }); setEnded(null); onChanged(); } });
  const save = useMutation({
    mutationFn: () => saveOutcome(d.lead.id, { callId: ended?.id ?? d.openCall?.id ?? null, connected: side === 'yes', outcome: outcome!, reason, nextCallAt: when ? new Date(when).toISOString() : null, note, durationSec: ended?.sec ?? null }),
    onSuccess: (r) => { setEnded(null); setSide(null); setOutcome(null); setReason(''); setWhen(''); setNote(''); onSaved(r); },
  });

  // Opened from a card's Call button: place the call once the lead has loaded.
  useEffect(() => {
    if (params.get('call') === '1') { setParams({}, { replace: true }); if (perms.canCall && !live) dial.mutate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!live) return; const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, [live]);

  const pick = (o: CallOutcome, mins: number | null) => { setOutcome(o); setReason(''); setWhen(mins == null ? '' : toLocalInput(new Date(Date.now() + mins * 60_000))); };
  const def = CONNECTED.find((o) => o.id === outcome);
  const sec = live ? Math.floor((Date.now() - live.t0) / 1000) + tick * 0 : 0;
  const canSave = !!outcome && (side === 'no' ? !!when : outcome === 'closed' ? !!reason : !!reason && !!when);
  const logging = !!ended || side !== null;

  if (!perms.canEdit) {
    return <section className="card card-dark" aria-label="Call outcome"><div className="card-head"><h3>Call outcome</h3><span className="pill">Not your lead</span></div><p>{perms.callBlock?.reason}</p></section>;
  }
  return (
    <section className="card card-dark" aria-label="Call outcome">
      <div className="card-head"><h3>Call outcome</h3><span className="pill">{live ? 'On call' : ended ? 'Call ended' : perms.callBlock ? perms.callBlock.label : 'Ready to call'}</span></div>

      {live && (
        <div className="call-live">
          <strong>Calling {live.mobile.replace(/(\d{5})(\d{5})/, '$1 $2')} · {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}</strong>
          <span>Say first: “This call is recorded for quality and training.”</span>
          <div className="form-actions"><a className="btn" href={`tel:+91${live.mobile}`}>Open dialer</a><button type="button" className="btn btn-danger" onClick={() => { setEnded({ id: live.id, sec }); setLive(null); }}>End call</button></div>
        </div>
      )}
      {!live && !logging && (
        <>
          {perms.callBlock ? <p className="note-bad">{perms.callBlock.reason}</p> : <button type="button" className="btn btn-primary btn-wide" disabled={dial.isPending} onClick={() => dial.mutate()}>Call</button>}
          {dial.isError && <p className="error" role="alert">{(dial.error as Error).message}</p>}
          {d.openCall && <p className="note-warn">You called at {clock(d.openCall.startedAt)}. No outcome saved yet. Add one whenever you like.</p>}
          <button type="button" className="link link-light" onClick={() => setSide('yes')}>{d.openCall ? 'Add the outcome' : 'Log an outcome without calling from here'}</button>
        </>
      )}
      {!live && logging && (
        <form className="outcome" onSubmit={(e: FormEvent) => { e.preventDefault(); if (canSave) save.mutate(); }}>
          {ended && <p className="note-warn">Call ended after {Math.floor((ended.sec ?? 0) / 60)} min {(ended.sec ?? 0) % 60} s. Log the outcome now or later.</p>}
          <div className="seg" role="group" aria-label="Did the customer pick up?">
            <button type="button" aria-pressed={side === 'yes'} onClick={() => { setSide('yes'); setOutcome(null); }}>Connected<small>Customer picked up</small></button>
            <button type="button" aria-pressed={side === 'no'} onClick={() => { setSide('no'); pick('no_answer', 1440); }}>Not connected<small>No one picked up</small></button>
          </div>
          {side === 'yes' && (
            <div className="seg seg-4" role="group" aria-label="What happened on the call?">
              {CONNECTED.map((o) => <button key={o.id} type="button" aria-pressed={outcome === o.id} onClick={() => pick(o.id, o.nextMins)}>{o.label}</button>)}
            </div>
          )}
          {side === 'no' && (
            <div className="seg seg-3" role="group" aria-label="What happened?">
              {MISSED.map((o) => <button key={o.id} type="button" aria-pressed={outcome === o.id} onClick={() => setOutcome(o.id)}>{o.label}</button>)}
            </div>
          )}
          {side === 'yes' && def && <label>{def.ask}<select value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Choose one</option>{def.reasons.map((r) => <option key={r}>{r}</option>)}</select></label>}
          {outcome && outcome !== 'closed' && <label>{outcome === 'call_later' ? 'Call back on' : 'Next call'}<input type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} /></label>}
          {outcome && <label>Remarks (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></label>}
          {def && <p className="effect">{def.effect}</p>}
          {!ended && !d.openCall && <p className="muted-light small">You did not call from here, so this is saved as a manual entry.</p>}
          {save.isError && <p className="error" role="alert">{(save.error as Error).message}</p>}
          <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={!canSave || save.isPending}>Save outcome</button><button type="button" className="btn btn-ghost" onClick={() => { setSide(null); setOutcome(null); setEnded(null); onChanged(); }}>Not now</button></div>
        </form>
      )}
    </section>
  );
}

function History({ d }: { d: LeadDetail }) {
  return (
    <section className="card" aria-label="History">
      <div className="card-head"><h3>History</h3><span className="muted small">{d.history.length} {d.history.length === 1 ? 'entry' : 'entries'}</span></div>
      {d.history.length === 0 ? <p className="muted">No calls yet. The first attempt will appear here.</p> : (
        <ul className="history">
          {d.history.map((h) => <li key={h.id}><span className="muted small">{whenLabel(h.at)}</span><span className={`pill ${h.by === 'AI' ? 'pill-ai' : 'pill-info'}`}>{h.by}</span><span>{h.text}</span><span className="muted small">{h.meta}</span></li>)}
        </ul>
      )}
    </section>
  );
}
