// Domain types. Each interface mirrors a table in db/schema.sql (snake_case there, camelCase here).
// Dates are ISO strings: 'YYYY-MM-DD' for dates, full ISO for timestamps.

export type Role = 'telecaller' | 'team_lead' | 'admin';
export type UserStatus = 'active' | 'on_leave' | 'left';
export type LeadSource = 'own_renewal' | 'renewal_from_service' | 'renewal_from_sales' | 'winback' | 'own_lost' | 'other_data';
export type LeadStatus = 'not_contacted' | 'not_connected' | 'callback' | 'follow_up' | 'hot' | 'renewed' | 'lost';
export type AllottedWhy = 'renewer' | 'renewer_left' | 'round_robin' | 'moved';

export interface Dealer {
  id: string;
  name: string;
  timezone: string;
  callStartHour: number;
  callEndHour: number;
  aiPickupDays: number;
  ruleRenewerFirst: boolean;
}

export interface User {
  id: string;
  dealerId: string;
  branch: string;
  name: string;
  mobile: string;
  role: Role;
  status: UserStatus;
  reportsTo: string | null;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  altMobile: string | null;
  email: string | null;
  language: string;
  address: string | null;
  doNotCall: boolean;
  doNotMessage: boolean;
  wrongNumber: boolean;
}

export interface Vehicle {
  id: string;
  customerId: string;
  model: string;
  regNo: string;
  chassisNo: string | null;
  engineNo: string | null;
  isElectric: boolean;
}

export interface Policy {
  id: string;
  vehicleId: string;
  insurer: string;
  policyNo: string | null;
  policyType: 'OD+TP' | 'OD only' | 'TP only';
  odStart: string | null;
  odEnd: string | null;
  tpStart: string | null;
  tpEnd: string | null;
  premium: number | null;
  idv: number | null;
  ncbPercent: number | null;
  issuedBy: string | null;
  issuedOn: string | null;
  isRenewal: boolean;
}

export interface Lead {
  id: string;
  dealerId: string;
  customerId: string;
  vehicleId: string;
  prevPolicyId: string | null;
  source: LeadSource;
  status: LeadStatus;
  expiryDate: string;
  ownerId: string;
  allottedOn: string;
  allottedWhy: AllottedWhy;
  whyNow: string | null;
  nextCallAt: string | null;
  callbackPromised: boolean;
  lostReason: string | null;
  aiQualifiedAt: string | null;
  closedAt: string | null;
}

export interface Quote {
  id: string;
  leadId: string;
  insurer: string;
  kind: 'live' | 'manual';
  premium: number | null;
  idv: number | null;
  ncbPercent: number | null;
  addons: string | null;
  paymentLink: string | null;
  linkExpiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export type CallOutcome = 'agreed' | 'deciding' | 'call_later' | 'closed' | 'no_answer' | 'switched_off' | 'busy';

export interface Call {
  id: string;
  leadId: string;
  madeBy: 'caller' | 'ai';
  userId: string | null;
  startedAt: string;
  endedAt: string | null;
  connected: boolean | null;
  durationSec: number | null;
  outcome: CallOutcome | null;
  reason: string | null;
  note: string | null;
  manual: boolean;
}

export interface Message {
  id: string;
  leadId: string;
  channel: 'whatsapp' | 'sms' | 'email';
  template: string;
  body: string;
  sentBy: string | null;
  sentAt: string;
  status: string;
}

// ---------- shapes the API returns to screens ----------

export interface Session {
  token: string;
  user: User;
  dealer: Dealer;
}

export interface LeadPermissions {
  canEdit: boolean; // log outcomes, add quotes, change details
  canCall: boolean;
  canMessage: boolean;
  callBlock: { code: 'not_owner' | 'do_not_call' | 'wrong_number' | 'outside_hours'; label: string; reason: string } | null;
}

export type AiState = { kind: 'none' } | { kind: 'qualified'; at: string } | { kind: 'with_ai'; pendingDays: number } | { kind: 'soon'; pendingDays: number };

export interface LeadCard {
  id: string;
  customerName: string;
  model: string;
  regNo: string;
  source: LeadSource;
  status: LeadStatus;
  expiryDate: string;
  daysToExpiry: number;
  whyNow: string | null;
  nextCallAt: string | null;
  callbackPromised: boolean;
  ownerId: string;
  ownerName: string;
  isMine: boolean;
  ai: AiState;
  bestQuote: { insurer: string; premium: number } | null;
  attempts: { caller: number; ai: number };
  group: 'call_now' | 'later_today' | 'upcoming';
  permissions: LeadPermissions;
}

export interface QueueResponse {
  total: number; // leads in this user's queue before filters
  counts: { due: number; hot: number; followUps: number; all: number; aiQualified: number; expiring7: number; ownRenewal: number };
  leads: LeadCard[];
}

export interface HistoryItem {
  id: string;
  kind: 'call' | 'message';
  at: string;
  by: string; // 'You', a name, or 'AI'
  text: string;
  meta: string;
}

export interface LeadDetail {
  lead: Lead;
  card: LeadCard;
  customer: { name: string; language: string; address: string | null; mobileMasked: string; emailMasked: string | null; doNotCall: boolean };
  vehicle: Vehicle;
  prevPolicy: Policy | null;
  renewedBefore: string; // one plain sentence
  quotes: Quote[];
  history: HistoryItem[];
  openCall: Call | null; // a call started from the CRM that has no outcome yet
}

export interface TodaySummary {
  callsToday: number;
  callsTarget: number;
  connectedToday: number;
  renewedToday: number;
  lostToday: number;
  monthPolicies: number;
  monthTarget: number;
}

export interface QueueQuery {
  tab: 'due' | 'hot' | 'followUps' | 'all';
  aiQualified?: boolean;
  expiringInDays?: number;
  source?: LeadSource;
}

export interface OutcomeInput {
  callId: string | null; // null = logged without a call from the CRM
  connected: boolean;
  outcome: CallOutcome;
  reason: string;
  nextCallAt: string | null;
  note: string;
  durationSec: number | null;
}

export interface QuoteInput {
  insurer: string;
  premium: number | null;
  idv: number | null;
  ncbPercent: number | null;
  addons: string | null;
  paymentLink: string | null;
  linkValidMinutes: number | null;
}

export const SOURCE_LABEL: Record<LeadSource, string> = {
  own_renewal: 'Own renewal',
  renewal_from_service: 'Renewal from service',
  renewal_from_sales: 'Renewal from sales',
  winback: 'Winback',
  own_lost: 'Own lost',
  other_data: 'Other data',
};

export const ROLE_LABEL: Record<Role, string> = { telecaller: 'Telecaller', team_lead: 'Team lead', admin: 'Admin' };
