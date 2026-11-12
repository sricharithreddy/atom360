// Small display helpers shared by screens.
export const rupees = (n: number | null | undefined) => (n == null ? '—' : '₹' + Math.round(n).toLocaleString('en-IN'));
export const lakh = (n: number | null | undefined) => (n == null ? 'Not known' : '₹' + (n / 100000).toFixed(2) + ' L');

export function dayMonth(date: string): string {
  return new Date(date.length === 10 ? date + 'T00:00:00' : date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

/** "Today 3:15 pm", "Yesterday 4:10 pm", "Tomorrow 10:00 am" or "6 Nov 3:45 pm". */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  const name = diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${name} ${clock(iso)}`;
}

export function expiryLabel(days: number): string {
  if (days < 0) return `Expired ${-days} ${days === -1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'Expires today';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

/** Value for <input type="datetime-local"> in the viewer's own timezone. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
