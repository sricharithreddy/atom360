import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStore } from '../api/client';
import { getMe, signIn as signInCall } from '../api/endpoints';
import type { Session } from '../domain/types';

interface AuthValue {
  session: Session | null;
  loading: boolean;
  signIn: (mobile: string, pin: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  const qc = useQueryClient();

  useEffect(() => {
    if (!tokenStore.get()) return;
    getMe().then(setSession).catch(() => tokenStore.set(null)).finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (mobile: string, pin: string) => {
    const s = await signInCall(mobile, pin);
    tokenStore.set(s.token);
    qc.clear();
    setSession(s);
  }, [qc]);

  const signOut = useCallback(() => {
    tokenStore.set(null);
    qc.clear();
    setSession(null);
  }, [qc]);

  const value = useMemo(() => ({ session, loading, signIn, signOut }), [session, loading, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

/** The signed-in session. Only call from screens behind the sign-in gate. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('No session');
  return session;
}
