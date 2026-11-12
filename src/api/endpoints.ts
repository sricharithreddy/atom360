import type { Call, LeadCard, LeadDetail, OutcomeInput, QueueQuery, QueueResponse, QuoteInput, Session, TodaySummary } from '../domain/types';
import { api } from './client';

export const signIn = (mobile: string, pin: string) => api<Session>('POST', '/auth/sign-in', { mobile, pin });
export const getMe = () => api<Session>('GET', '/me');
export const getTodaySummary = () => api<TodaySummary>('GET', '/today/summary');

export function getQueue(q: QueueQuery) {
  const p = new URLSearchParams({ tab: q.tab });
  if (q.aiQualified) p.set('aiQualified', 'true');
  if (q.expiringInDays != null) p.set('expiringInDays', String(q.expiringInDays));
  if (q.source) p.set('source', q.source);
  return api<QueueResponse>('GET', `/queue?${p}`);
}

export const searchLeads = (q: string) => api<LeadCard[]>('GET', `/leads/search?q=${encodeURIComponent(q)}`);
export const getLead = (id: string) => api<LeadDetail>('GET', `/leads/${id}`);
export const revealContact = (id: string, field: 'mobile' | 'email') => api<{ value: string }>('POST', `/leads/${id}/reveal`, { field });
export const startCall = (id: string) => api<{ call: Call; mobile: string }>('POST', `/leads/${id}/calls`);
export const saveOutcome = (id: string, input: OutcomeInput) => api<LeadDetail>('POST', `/leads/${id}/outcomes`, input);
export const saveQuote = (id: string, input: QuoteInput & { id?: string }) => api<LeadDetail>('POST', `/leads/${id}/quotes`, input);
export const openWhatsApp = (id: string, template: 'reminder' | 'quote') => api<{ body: string; waUrl: string }>('POST', `/leads/${id}/messages`, { template });

// sample-data controls, only present when the fake server is running
export interface MockSettings { ignoreCallingHours: boolean; users: { name: string; role: string; mobile: string; pin: string }[] }
export const getMockSettings = () => api<MockSettings>('GET', '/mock/settings');
export const setMockSettings = (s: { ignoreCallingHours: boolean }) => api<unknown>('POST', '/mock/settings', s);
export const resetMock = () => api<unknown>('POST', '/mock/reset');
