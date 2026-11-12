import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { searchLeads } from '../api/endpoints';
import { ROLE_LABEL } from '../domain/types';
import { SignIn } from '../features/auth/SignIn';
import { TodayPage } from '../features/today/TodayPage';
import { useAuth } from './auth';
import { IS_MOCK } from './env';

export function App() {
  const { session, loading } = useAuth();
  if (loading) return <p className="splash">Loading…</p>;
  if (!session) return <SignIn />;
  return (
    <div className="shell">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/lead/:leadId" element={<TodayPage />} />
          <Route path="*" element={<TodayPage />} />
        </Routes>
      </main>
    </div>
  );
}

function Header() {
  const { session, signOut } = useAuth();
  const user = session!.user;
  return (
    <header className="header">
      <strong className="brand">Autoprism <span>Insurance</span></strong>
      <Search />
      <div className="header-right">
        {IS_MOCK && <span className="pill pill-warn" title="Data is stored in this browser only">Sample data</span>}
        <span className="who"><strong>{user.name}</strong> · {ROLE_LABEL[user.role]} · {session!.dealer.name}</span>
        <button type="button" className="btn btn-quiet" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}

function Search() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 250); return () => clearTimeout(t); }, [text]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const { data, isFetching } = useQuery({ queryKey: ['search', q], queryFn: () => searchLeads(q), enabled: q.length >= 2 });
  const show = open && q.length >= 2;
  return (
    <div className="search" ref={box}>
      <label htmlFor="search" className="sr">Search leads</label>
      <input id="search" type="search" autoComplete="off" placeholder="Name, reg no, mobile or policy no" value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {show && (
        <div className="search-results" role="listbox" aria-label="Search results">
          {data?.map((l) => (
            <button key={l.id} type="button" role="option" aria-selected="false" onClick={() => { setOpen(false); setText(''); navigate(`/lead/${l.id}`); }}>
              <span><strong>{l.customerName}</strong><small>{l.regNo} · {l.model}{l.status === 'renewed' ? ' · Renewed' : l.status === 'lost' ? ' · Lost' : ''}</small></span>
              <span className={`pill ${l.isMine ? 'pill-good' : 'pill-info'}`}>{l.isMine ? 'Your lead' : `Owner ${l.ownerName}`}</span>
              {!l.permissions.canEdit && <small>View only</small>}
            </button>
          ))}
          {data && data.length === 0 && !isFetching && <p>No lead found.</p>}
          {!data && <p>Searching…</p>}
        </div>
      )}
    </div>
  );
}
