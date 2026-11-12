// Rules the server enforces on leads. Pure functions: the fake server runs them today,
// the real backend runs the same code later.
import type { AiState, Customer, Dealer, Lead, LeadPermissions, Policy, User } from '../domain/types';
import { dateIn, daysBetween, hourIn } from './time';

export const isManager = (u: Pick<User, 'role'>) => u.role === 'team_lead' || u.role === 'admin';

/** Only the owner, a team lead or an admin can change a lead or log an outcome on it. */
export function canEditLead(user: Pick<User, 'id' | 'role'>, lead: Pick<Lead, 'ownerId'>): boolean {
  return isManager(user) || lead.ownerId === user.id;
}

/** Why a call is not allowed right now, or null when it is. Order matters: the most permanent reason wins. */
export function callBlock(user: Pick<User, 'id' | 'role'>, lead: Pick<Lead, 'ownerId'>, customer: Pick<Customer, 'doNotCall' | 'wrongNumber'>, dealer: Dealer, ownerName: string, now: Date): LeadPermissions['callBlock'] {
  if (customer.wrongNumber) return { code: 'wrong_number', label: 'Wrong number', reason: 'This number is wrong. Calls and messages stop until you add the correct number.' };
  if (customer.doNotCall) return { code: 'do_not_call', label: 'Do not call', reason: 'The customer asked not to be called.' };
  if (!canEditLead(user, lead)) return { code: 'not_owner', label: 'Not your lead', reason: `This lead belongs to ${ownerName}. Only ${ownerName} or a team lead can call it. You can send a WhatsApp message.` };
  const h = hourIn(dealer.timezone, now);
  if (h < dealer.callStartHour || h >= dealer.callEndHour) return { code: 'outside_hours', label: 'Calling closed', reason: `You can call between ${hourLabel(dealer.callStartHour)} and ${hourLabel(dealer.callEndHour)}.` };
  return null;
}

export function permissionsFor(user: Pick<User, 'id' | 'role'>, lead: Pick<Lead, 'ownerId'>, customer: Pick<Customer, 'doNotCall' | 'doNotMessage' | 'wrongNumber'>, dealer: Dealer, ownerName: string, now: Date): LeadPermissions {
  const block = callBlock(user, lead, customer, dealer, ownerName, now);
  return { canEdit: canEditLead(user, lead), canCall: block === null, canMessage: !customer.doNotMessage && !customer.wrongNumber, callBlock: block };
}

export function hourLabel(h: number): string {
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`;
}

/** Days a scheduled call has been waiting. 0 when nothing is due. */
export function pendingDays(lead: Pick<Lead, 'nextCallAt' | 'status'>, dealer: Dealer, now: Date): number {
  if (!lead.nextCallAt || lead.status === 'renewed' || lead.status === 'lost') return 0;
  const due = dateIn(dealer.timezone, new Date(lead.nextCallAt));
  return Math.max(0, daysBetween(due, dateIn(dealer.timezone, now)));
}

/** AI calls in parallel: it picks up a call pending for more than dealer.aiPickupDays, and never calls a do-not-call customer. */
export function aiState(lead: Pick<Lead, 'nextCallAt' | 'status' | 'aiQualifiedAt'>, customer: Pick<Customer, 'doNotCall' | 'wrongNumber'>, dealer: Dealer, now: Date): AiState {
  if (customer.doNotCall || customer.wrongNumber) return { kind: 'none' };
  if (lead.aiQualifiedAt) return { kind: 'qualified', at: lead.aiQualifiedAt };
  const p = pendingDays(lead, dealer, now);
  if (p > dealer.aiPickupDays) return { kind: 'with_ai', pendingDays: p };
  if (p === dealer.aiPickupDays && p > 0) return { kind: 'soon', pendingDays: p };
  return { kind: 'none' };
}

export type QueueGroup = 'call_now' | 'later_today' | 'upcoming';

/** Where a lead sits in Today. AI qualified leads and anything already due go to "Call now". */
export function queueGroup(lead: Pick<Lead, 'nextCallAt' | 'aiQualifiedAt'>, dealer: Dealer, now: Date): QueueGroup {
  if (lead.aiQualifiedAt) return 'call_now';
  if (!lead.nextCallAt) return 'upcoming';
  const due = new Date(lead.nextCallAt);
  if (due.getTime() <= now.getTime()) return 'call_now';
  return dateIn(dealer.timezone, due) === dateIn(dealer.timezone, now) ? 'later_today' : 'upcoming';
}

/** Order inside a group: promised callbacks first, then AI qualified, then by the time the call is due. */
export function queueRank(lead: Pick<Lead, 'callbackPromised' | 'aiQualifiedAt' | 'nextCallAt'>, now: Date): number {
  const due = lead.nextCallAt ? new Date(lead.nextCallAt).getTime() : Number.MAX_SAFE_INTEGER;
  const promisedDue = lead.callbackPromised && due <= now.getTime();
  return (promisedDue ? 0 : lead.aiQualifiedAt ? 1 : 2) * 1e15 + Math.min(due, 9e14);
}

export const isOpen = (lead: Pick<Lead, 'status'>) => lead.status !== 'renewed' && lead.status !== 'lost';

/** "You renewed this customer in 2025." One plain sentence about who handled this customer before. */
export function renewedBeforeSentence(prev: Pick<Policy, 'issuedBy' | 'issuedOn'> | null, firstIssue: boolean, users: Pick<User, 'id' | 'name' | 'status'>[], me: Pick<User, 'id'>, ownerName: string): string {
  if (!prev || !prev.issuedBy || !prev.issuedOn) return 'Not renewed with us before.';
  const who = users.find((u) => u.id === prev.issuedBy);
  if (!who) return 'Not renewed with us before.';
  const did = `${who.id === me.id ? 'You' : who.name} ${firstIssue ? 'issued the policy to this customer' : 'renewed this customer'} in ${prev.issuedOn.slice(0, 4)}`;
  return who.status === 'left' ? `${did} and has left. Now with ${ownerName}.` : `${did}.`;
}
