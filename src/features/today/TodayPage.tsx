import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getQueue, getTodaySummary } from '../../api/endpoints';
import { clock, expiryLabel, rupees, whenLabel } from '../../app/format';
import { SOURCE_LABEL, type LeadCard, type QueueQuery } from '../../domain/types';
import { LeadPanel } from '../lead/LeadPanel';

const TABS: { id: QueueQuery['tab']; label: string; count: 'due' | 'hot' | 'followUps' | 'all' }[] = [
  { id: 'due', label: 'Due now', count: 'due' },
  { id: 'hot', label: 'Hot', count: 'hot' },
  { id: 'followUps', label: 'Follow-ups', count: 'followUps' },
  { id: 'all', label: 'All', count: 'all' },
];
const GROUPS: { id: LeadCard['group']; title: string; note: string }[] = [
  { id: 'call_now', title: 'Call now', note: 'promised callbacks first, then AI qualified, then calls due now' },
  { id: 'later_today', title: 'Later today', note: 'in time order' },
  { id: 'upcoming', title: 'Coming up', note: 'scheduled' },
];

export function TodayPage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState<QueueQuery>({ tab: 'all' });
  const summary = useQuery({ queryKey: ['summary'], queryFn: getTodaySummary });
  const queue = useQuery({ queryKey: ['queue', query], queryFn: () => getQueue(query), placeholderData: (prev) => prev });
  const data = queue.data;
  const filtered = !!(query.aiQualified || query.expiringInDays != null || query.source);
  const promised = data?.leads.find((l) => l.callbackPromised && l.group === 'call_now' && l.isMine && l.permissions.canCall && l.id !== leadId);
  const s = summary.data;

  return (
    <>
      <div className="today">
        {s && (
          <section className="strip" aria-label="Today at a glance">
            <div><span>Calls today</span><strong>{s.callsToday} <small>/ {s.callsTarget}</small></strong></div>
            <div><span>Connected</span><strong>{s.connectedToday} <small>· {s.callsToday ? Math.round((s.connectedToday / s.callsToday) * 100) : 0}%</small></strong></div>
            <div><span>Renewed today</span><strong className="good">{s.renewedToday}</strong></div>
            <div><span>Lost today</span><strong className="bad">{s.lostToday}</strong></div>
            <div className="strip-target"><span>Month target <b>{s.monthPolicies} / {s.monthTarget}</b></span><i aria-hidden="true"><i style={{ width: `${Math.min(100, s.monthTarget ? (s.monthPolicies / s.monthTarget) * 100 : 0)}%` }} /></i></div>
          </section>
        )}

        {promised && (
          <div className="banner" role="alert">
            <div><small>CALLBACK DUE</small><strong>{promised.customerName} · promised {clock(promised.nextCallAt!)}</strong><span>Promised callbacks come first.</span></div>
            <button type="button" className="btn btn-danger" onClick={() => navigate(`/lead/${promised.id}?call=1`)}>Call now</button>
          </div>
        )}

        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="Views">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={query.tab === t.id} onClick={() => setQuery({ ...query, tab: t.id })}>
                {t.label}<span className={t.id === 'due' ? 'count count-hot' : 'count'}>{data?.counts[t.count] ?? '–'}</span>
              </button>
            ))}
          </div>
          <span className="divider" aria-hidden="true" />
          <div className="keys" role="group" aria-label="Key filters">
            <button type="button" className="key key-ai" aria-pressed={!!query.aiQualified} onClick={() => setQuery({ ...query, aiQualified: !query.aiQualified })}>AI qualified<span>{data?.counts.aiQualified ?? '–'}</span></button>
            <button type="button" className="key" aria-pressed={query.expiringInDays === 7} onClick={() => setQuery({ ...query, expiringInDays: query.expiringInDays === 7 ? undefined : 7 })}>Expiring in 7 days<span>{data?.counts.expiring7 ?? '–'}</span></button>
            <button type="button" className="key" aria-pressed={query.source === 'own_renewal'} onClick={() => setQuery({ ...query, source: query.source ? undefined : 'own_renewal' })}>Own renewal<span>{data?.counts.ownRenewal ?? '–'}</span></button>
          </div>
          {filtered && data && <><button type="button" className="link" onClick={() => setQuery({ tab: query.tab })}>Clear all</button><span className="muted small">Showing <b>{data.leads.length}</b> of {data.total}</span></>}
        </div>

        {queue.isError && <p className="error" role="alert">{(queue.error as Error).message}</p>}
        {data && data.leads.length === 0 && <p className="empty">No leads match. Clear the filters or pick another view.</p>}
        {data && GROUPS.map((g) => {
          const leads = data.leads.filter((l) => l.group === g.id);
          if (!leads.length) return null;
          return (
            <section key={g.id} className="group" aria-label={g.title}>
              <h2 className={g.id === 'call_now' ? 'hot' : ''}>{g.title} <small>{leads.length} {leads.length === 1 ? 'lead' : 'leads'} · {g.note}</small></h2>
              <ul>{leads.map((l) => <li key={l.id}><Card lead={l} onOpen={(call) => navigate(`/lead/${l.id}${call ? '?call=1' : ''}`)} /></li>)}</ul>
            </section>
          );
        })}
      </div>
      {leadId && <LeadPanel leadId={leadId} onClose={() => navigate('/')} />}
    </>
  );
}

function Card({ lead: l, onOpen }: { lead: LeadCard; onOpen: (call: boolean) => void }) {
  const urgent = l.daysToExpiry < 0 ? 'bad' : l.daysToExpiry <= 15 ? 'warn' : '';
  return (
    <article className={`lead-card bar-${l.ai.kind === 'qualified' ? 'ai' : l.group === 'call_now' ? 'hot' : l.status === 'hot' ? 'good' : 'plain'}`} onClick={() => onOpen(false)}>
      <div className="lead-main">
        <h3>{l.customerName}</h3>
        <p className="muted">{l.model} · {l.regNo} · {SOURCE_LABEL[l.source]}</p>
        <p className="why">{l.whyNow}</p>
      </div>
      <div className="lead-facts">
        <div className="chips">
          {l.ai.kind === 'qualified' && <span className="pill pill-ai-solid">AI qualified</span>}
          {l.ai.kind === 'with_ai' && <span className="pill pill-ai">With AI · {l.ai.pendingDays} days pending</span>}
          {l.ai.kind === 'soon' && <span className="pill pill-warn">AI calls tomorrow</span>}
          {l.callbackPromised && l.nextCallAt && <span className="pill pill-bad">Promised {whenLabel(l.nextCallAt)}</span>}
          {!l.isMine && <span className="pill pill-info">Owner {l.ownerName}</span>}
        </div>
        <p className="muted small">{l.attempts.caller + l.attempts.ai === 0 ? 'No attempts yet' : `${l.attempts.caller + l.attempts.ai} attempts · AI ${l.attempts.ai} · ${l.isMine ? 'you' : l.ownerName} ${l.attempts.caller}`}{l.bestQuote ? ` · best quote ${l.bestQuote.insurer} ${rupees(l.bestQuote.premium)}` : ' · no quote yet'}</p>
        <p className="small">{l.ai.kind === 'qualified' ? <b className="hot">Call now · customer wants to renew</b> : l.nextCallAt ? <>Next call <b>{whenLabel(l.nextCallAt)}</b></> : 'No call scheduled'}</p>
      </div>
      <div className="lead-side">
        <strong className={urgent}>{expiryLabel(l.daysToExpiry)}</strong>
        <button type="button" className={`btn ${l.permissions.canCall ? 'btn-primary' : 'btn-blocked'}`} onClick={(e) => { e.stopPropagation(); onOpen(l.permissions.canCall); }}>{l.permissions.callBlock ? l.permissions.callBlock.label : 'Call'}</button>
      </div>
    </article>
  );
}
