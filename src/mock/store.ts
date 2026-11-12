// The fake server's database. It lives in this browser only (localStorage), so each person sees their own copy.
import type { Call, Customer, Dealer, Lead, Message, Policy, Quote, User, Vehicle } from '../domain/types';
import { buildSeed } from './seed';

export interface MockUser extends User {
  pin: string; // plain text here only because this is sample data; the real backend stores a hash
}

export interface Db {
  version: number;
  dealer: Dealer;
  users: MockUser[];
  customers: Customer[];
  vehicles: Vehicle[];
  policies: Policy[];
  leads: Lead[];
  quotes: Quote[];
  calls: Call[];
  messages: Message[];
  reveals: { leadId: string; userId: string; field: string; at: string }[];
  targets: Record<string, { policiesPerMonth: number; callsPerDay: number }>;
  rrCursor: number;
  settings: { ignoreCallingHours: boolean };
}

const KEY = 'autoprism-insurance-mock';
const VERSION = 1;
let db: Db | null = null;

function read(): Db | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Db;
    return parsed.version === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function getDb(): Db {
  if (!db) db = read() ?? { ...buildSeed(new Date()), version: VERSION };
  return db;
}

export function save(): void {
  try {
    if (db) localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage can be blocked (private window); the app still works for this visit */
  }
}

export function resetDb(): Db {
  db = { ...buildSeed(new Date()), version: VERSION };
  save();
  return db;
}

export const newId = () => crypto.randomUUID();
