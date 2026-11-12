// Date helpers. Everything takes "now" as an argument so the rules stay pure and testable.
const DAY = 86_400_000;

/** 'YYYY-MM-DD' for the given instant in the dealer's timezone. */
export function dateIn(tz: string, now: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return p; // en-CA formats as YYYY-MM-DD
}

/** Hour of day (0-23) for the given instant in the dealer's timezone. */
export function hourIn(tz: string, now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now));
}

/** Whole days from date a to date b (both 'YYYY-MM-DD'). Negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
}
