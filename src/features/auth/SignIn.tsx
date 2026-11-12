import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { getMockSettings, resetMock, setMockSettings, type MockSettings } from '../../api/endpoints';
import { useAuth } from '../../app/auth';
import { IS_MOCK } from '../../app/env';
import { ROLE_LABEL, type Role } from '../../domain/types';

export function SignIn() {
  const { signIn } = useAuth();
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState<MockSettings | null>(null);

  useEffect(() => { if (IS_MOCK) getMockSettings().then(setMock).catch(() => undefined); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mobile.replace(/\D/g, '').length < 10) return setError('Enter your 10-digit mobile number.');
    if (pin.length !== 4) return setError('Enter your 4-digit PIN.');
    setBusy(true); setError('');
    try { await signIn(mobile, pin); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.'); } finally { setBusy(false); }
  }

  return (
    <div className="signin">
      <form className="card signin-card" onSubmit={submit} noValidate>
        <h1>Autoprism <span>Insurance</span></h1>
        <p className="muted">Sign in with your mobile number and PIN.</p>
        <label htmlFor="mobile">Mobile number</label>
        <div className="mobile-field"><span>+91</span><input id="mobile" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} /></div>
        <label htmlFor="pin">PIN</label>
        <input id="pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">Forgot your PIN? Ask your admin to reset it.</p>
      </form>

      {mock && (
        <aside className="card signin-card" aria-label="Sample data">
          <h2>Sample data</h2>
          <p className="muted">This build runs on sample data kept in this browser. Pick a person to fill in their details.</p>
          <div className="sample-users">
            {mock.users.map((u) => (
              <button key={u.mobile} type="button" className="btn" onClick={() => { setMobile(u.mobile); setPin(u.pin); setError(''); }}>
                <strong>{u.name}</strong> <small>{ROLE_LABEL[u.role as Role]} · {u.mobile} · PIN {u.pin}</small>
              </button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={mock.ignoreCallingHours} onChange={(e) => { const v = e.target.checked; setMock({ ...mock, ignoreCallingHours: v }); void setMockSettings({ ignoreCallingHours: v }); }} /> Allow calls outside 8 am to 6 pm (for trying it out in the evening)</label>
          <button type="button" className="btn btn-quiet" onClick={async () => { await resetMock(); setMock(await getMockSettings()); }}>Reset sample data</button>
        </aside>
      )}
    </div>
  );
}
