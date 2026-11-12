import { describe, expect, it } from 'vitest';
import type { Dealer } from '../domain/types';
import { allocateLead } from './allocation';
import { aiState, callBlock, canEditLead, pendingDays, queueGroup, queueRank, renewedBeforeSentence } from './leadRules';
import { addDays, dateIn, daysBetween, hourIn } from './time';

const dealer: Dealer = { id: 'd', name: 'Demo', timezone: 'Asia/Kolkata', callStartHour: 8, callEndHour: 18, aiPickupDays: 2, ruleRenewerFirst: true };
const anitha = { id: 'u1', role: 'telecaller' as const, status: 'active' as const, name: 'Anitha' };
const harsha = { id: 'u2', role: 'telecaller' as const, status: 'active' as const, name: 'Harsha' };
const kiran = { id: 'u3', role: 'telecaller' as const, status: 'left' as const, name: 'Kiran' };
const ravi = { id: 'u4', role: 'team_lead' as const, status: 'active' as const, name: 'Ravi' };
const noon = new Date('2026-11-12T06:30:00Z'); // 12:00 in India
const ok = { doNotCall: false, wrongNumber: false };

describe('time', () => {
  it('works in the dealer timezone', () => {
    expect(dateIn('Asia/Kolkata', new Date('2026-11-12T20:00:00Z'))).toBe('2026-11-13');
    expect(hourIn('Asia/Kolkata', noon)).toBe(12);
    expect(daysBetween('2026-11-12', addDays('2026-11-12', 7))).toBe(7);
  });
});

describe('ownership', () => {
  it('lets only the owner or a manager edit', () => {
    expect(canEditLead(anitha, { ownerId: 'u1' })).toBe(true);
    expect(canEditLead(harsha, { ownerId: 'u1' })).toBe(false);
    expect(canEditLead(ravi, { ownerId: 'u1' })).toBe(true);
  });
  it('blocks a call for the right reason, most permanent first', () => {
    expect(callBlock(harsha, { ownerId: 'u1' }, ok, dealer, 'Anitha', noon)?.code).toBe('not_owner');
    expect(callBlock(anitha, { ownerId: 'u1' }, { doNotCall: true, wrongNumber: false }, dealer, 'Anitha', noon)?.code).toBe('do_not_call');
    expect(callBlock(anitha, { ownerId: 'u1' }, { doNotCall: true, wrongNumber: true }, dealer, 'Anitha', noon)?.code).toBe('wrong_number');
    expect(callBlock(anitha, { ownerId: 'u1' }, ok, dealer, 'Anitha', new Date('2026-11-12T14:00:00Z'))?.code).toBe('outside_hours'); // 7:30 pm
    expect(callBlock(anitha, { ownerId: 'u1' }, ok, dealer, 'Anitha', noon)).toBeNull();
  });
});

describe('allocation', () => {
  const users = [anitha, harsha, kiran, ravi];
  it('gives the lead to the earlier renewer when still active', () => {
    expect(allocateLead({ issuedBy: 'u2' }, users, dealer, 0)).toEqual({ ownerId: 'u2', why: 'renewer', nextCursor: 0 });
  });
  it('keeps the lead with a renewer who is on leave', () => {
    const onLeave = users.map((u) => (u.id === 'u2' ? { ...u, status: 'on_leave' as const } : u));
    expect(allocateLead({ issuedBy: 'u2' }, onLeave, dealer, 0).ownerId).toBe('u2');
  });
  it('falls back to round robin when the renewer has left, and moves the cursor', () => {
    expect(allocateLead({ issuedBy: 'u3' }, users, dealer, 0)).toEqual({ ownerId: 'u1', why: 'renewer_left', nextCursor: 1 });
    expect(allocateLead(null, users, dealer, 1)).toEqual({ ownerId: 'u2', why: 'round_robin', nextCursor: 2 });
  });
  it('skips the renewer rule when the admin turns it off', () => {
    expect(allocateLead({ issuedBy: 'u2' }, users, { ruleRenewerFirst: false }, 0).ownerId).toBe('u1');
  });
});

describe('AI in parallel', () => {
  const lead = (daysAgo: number, extra = {}) => ({ nextCallAt: new Date(noon.getTime() - daysAgo * 86_400_000).toISOString(), status: 'follow_up' as const, aiQualifiedAt: null, ...extra });
  it('counts pending days and picks up after more than two', () => {
    expect(pendingDays(lead(3), dealer, noon)).toBe(3);
    expect(aiState(lead(1), ok, dealer, noon).kind).toBe('none');
    expect(aiState(lead(2), ok, dealer, noon).kind).toBe('soon');
    expect(aiState(lead(3), ok, dealer, noon).kind).toBe('with_ai');
  });
  it('never calls a do-not-call customer and shows qualified first', () => {
    expect(aiState(lead(5), { doNotCall: true, wrongNumber: false }, dealer, noon).kind).toBe('none');
    expect(aiState(lead(5, { aiQualifiedAt: noon.toISOString() }), ok, dealer, noon).kind).toBe('qualified');
  });
});

describe('queue', () => {
  it('groups by when the call is due', () => {
    expect(queueGroup({ nextCallAt: new Date(noon.getTime() - 60_000).toISOString(), aiQualifiedAt: null }, dealer, noon)).toBe('call_now');
    expect(queueGroup({ nextCallAt: new Date(noon.getTime() + 3_600_000).toISOString(), aiQualifiedAt: null }, dealer, noon)).toBe('later_today');
    expect(queueGroup({ nextCallAt: new Date(noon.getTime() + 86_400_000).toISOString(), aiQualifiedAt: null }, dealer, noon)).toBe('upcoming');
    expect(queueGroup({ nextCallAt: new Date(noon.getTime() + 86_400_000).toISOString(), aiQualifiedAt: noon.toISOString() }, dealer, noon)).toBe('call_now');
  });
  it('puts promised callbacks first, then AI qualified, then the rest', () => {
    const past = new Date(noon.getTime() - 600_000).toISOString();
    const promised = queueRank({ callbackPromised: true, aiQualifiedAt: null, nextCallAt: past }, noon);
    const aiq = queueRank({ callbackPromised: false, aiQualifiedAt: past, nextCallAt: past }, noon);
    const plain = queueRank({ callbackPromised: false, aiQualifiedAt: null, nextCallAt: past }, noon);
    expect(promised).toBeLessThan(aiq);
    expect(aiq).toBeLessThan(plain);
  });
});

describe('plain sentences', () => {
  const users = [anitha, harsha, kiran];
  it('says who renewed before in one sentence', () => {
    expect(renewedBeforeSentence({ issuedBy: 'u1', issuedOn: '2025-11-20' }, false, users, anitha, 'Anitha')).toBe('You renewed this customer in 2025.');
    expect(renewedBeforeSentence({ issuedBy: 'u1', issuedOn: '2025-11-20' }, true, users, harsha, 'Anitha')).toBe('Anitha issued the policy to this customer in 2025.');
    expect(renewedBeforeSentence({ issuedBy: 'u3', issuedOn: '2024-12-01' }, false, users, anitha, 'Anitha')).toBe('Kiran renewed this customer in 2024 and has left. Now with Anitha.');
    expect(renewedBeforeSentence(null, false, users, anitha, 'Anitha')).toBe('Not renewed with us before.');
  });
});
