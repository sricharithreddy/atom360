// Who gets a new lead. Checked from the top; the first rule that fits decides.
import type { AllottedWhy, Dealer, Policy, User } from '../domain/types';

export interface Allocation {
  ownerId: string;
  why: AllottedWhy;
  nextCursor: number; // round-robin position to store for the next lead
}

/**
 * 1. Earlier renewer first: if the person who renewed or issued the previous policy is still active
 *    (on leave counts as active), the lead goes to them.
 * 2. Round robin among active telecallers for everything else.
 */
export function allocateLead(prev: Pick<Policy, 'issuedBy'> | null, users: Pick<User, 'id' | 'role' | 'status'>[], dealer: Pick<Dealer, 'ruleRenewerFirst'>, cursor: number): Allocation {
  const pool = users.filter((u) => u.role === 'telecaller' && u.status === 'active');
  if (!pool.length) throw new Error('No active telecaller to give this lead to.');
  const renewer = prev?.issuedBy ? users.find((u) => u.id === prev.issuedBy) : undefined;
  if (renewer && dealer.ruleRenewerFirst && renewer.role === 'telecaller' && renewer.status !== 'left') {
    return { ownerId: renewer.id, why: 'renewer', nextCursor: cursor };
  }
  const pick = pool[cursor % pool.length];
  return { ownerId: pick.id, why: renewer && renewer.status === 'left' ? 'renewer_left' : 'round_robin', nextCursor: cursor + 1 };
}
