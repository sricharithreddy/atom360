// Customer profile details the board does not carry: who sold the vehicle, date of birth, profession,
// plus edits callers make on the phone (mobile, email). SAMPLE DATA until the dealer system provides it.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MobileCtx } from './logic';

export interface Profile { sold: 'us' | 'ext'; soldYear: string; soldAt: string; dob: string; prof: string; mobile: string; email: string }

export const PROFESSIONS = ['Salaried', 'Business owner', 'Self-employed professional', 'Government employee', 'Retired', 'Homemaker', 'Student', 'Other'];

const SAMPLE: Record<string, Omit<Profile, 'mobile' | 'email'>> = {
  'Priya Sharma': { sold: 'ext', soldYear: '', soldAt: '', dob: '1988-03-14', prof: 'Salaried' },
  'Mohammed Irfan': { sold: 'us', soldYear: '2025', soldAt: 'Kukatpally showroom', dob: '1990-07-02', prof: 'Business owner' },
  'Sunita Rao': { sold: 'us', soldYear: '2021', soldAt: 'Kukatpally showroom', dob: '1975-11-21', prof: 'Government employee' },
  'Ramesh Kumar': { sold: 'us', soldYear: '2021', soldAt: 'Kukatpally showroom', dob: '1979-05-09', prof: 'Self-employed professional' },
  'Suresh Babu': { sold: 'us', soldYear: '2019', soldAt: 'Kukatpally showroom', dob: '1968-01-30', prof: 'Business owner' },
  'Arjun Reddy': { sold: 'ext', soldYear: '', soldAt: '', dob: '1992-09-17', prof: 'Salaried' },
  'Kavya Nair': { sold: 'us', soldYear: '2025', soldAt: 'Kukatpally showroom', dob: '1996-12-05', prof: 'Salaried' },
  'Venkat Swamy': { sold: 'us', soldYear: '2024', soldAt: 'Kukatpally showroom', dob: '1984-06-11', prof: 'Salaried' },
  'Fatima Begum': { sold: 'ext', soldYear: '', soldAt: '', dob: '1981-02-26', prof: 'Homemaker' },
  'Rahul Verma': { sold: 'us', soldYear: '2023', soldAt: 'Kukatpally showroom', dob: '1987-10-03', prof: 'Self-employed professional' },
  'Lakshmi Devi': { sold: 'us', soldYear: '2022', soldAt: 'Kukatpally showroom', dob: '1970-04-18', prof: 'Retired' },
  'Anjali Gupta': { sold: 'ext', soldYear: '', soldAt: '', dob: '', prof: '' },
};

export const plain = (n: any) => String(n || '').replace(/ \(\+1 car\)$/, '').replace(/ \+1 vehicle$/, '');

export function profileOf(ctx: MobileCtx, name: any): Profile {
  const key = plain(name);
  const base = SAMPLE[key] || { sold: 'ext' as const, soldYear: '', soldAt: '', dob: '', prof: '' };
  const edits = ((ctx.self.state.mProfile || {})[key]) || {};
  return { mobile: '', email: '', ...base, ...edits };
}

export function soldLabel(p: Profile): string {
  return p.sold === 'us' ? 'Sold by us' + (p.soldYear ? ' · ' + p.soldYear : '') : 'Bought elsewhere';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dobText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  // age on the demo date, 8 Nov 2026
  let age = 2026 - +m[1]; if (+m[2] > 11 || (+m[2] === 11 && +m[3] > 8)) age--;
  return +m[3] + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] + ' · ' + age + ' years';
}
export const maskMobile = (d: string) => (d.length === 10 ? '+91 ' + d.slice(0, 2) + '•••••' + d.slice(7) : d);
export const showMobile = (d: string) => (d.length === 10 ? '+91 ' + d.slice(0, 5) + ' ' + d.slice(5) : d);
export const maskEmail = (e: string) => { const [u, dom] = String(e).split('@'); return dom ? u.slice(0, 2) + '•••••' + u.slice(-2) + '@' + dom : e; };
