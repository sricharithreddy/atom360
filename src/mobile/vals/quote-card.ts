import type { MobileCtx } from '../logic';
import { logShare } from '../shares';

/** Branded quote card (m.qcard.*): an image of the quote, made on the phone, shared on WhatsApp. */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Placeholder dealership branding for the sample. Replace with the dealer's own name, branch and logo. */
export const DEALER = { name: 'Autoprism Motors', branch: 'Kukatpally', perks: ['Cashless claims at our workshop', '₹1,000 service coupon when you renew', 'Pay safely by UPI link'] };

const W = 1080;
const ink = '#0B1A47', muted = '#5B6482', line = '#E4E7F2', soft = '#F4F5FA';
const rupees = (t: any) => { const n = parseInt(String(t || '').replace(/[^0-9]/g, ''), 10); return n > 0 ? n : 0; };
const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function fit(c: CanvasRenderingContext2D, text: string, max: number): string {
  if (c.measureText(text).width <= max) return text;
  let t = text; while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/** One insurer option, as the quote editor holds it. */
interface Opt { name: string; total: number; idv: string; ncb: string; addons: string[]; lines: { k: string; v: string; minus?: boolean }[]; pick: boolean }
interface CardData { customer: string; vehicle: string; rtype: string; period: string; prevIns: string; options: Opt[]; saving: string; ncb: string; caller: string; date: string }

async function draw(d: CardData): Promise<string> {
  const rec = d.options[0];
  const H = 640 + 70 * rec.lines.length + 110 + (rec.addons.length ? 146 : 0) + 120 + 74 * d.options.length + (d.saving ? 104 : 0) + 250 + 120;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  try { await (document as any).fonts.ready; } catch { /* system font */ }
  const F = (w: number, s: number) => w + ' ' + s + 'px Inter, system-ui, sans-serif';
  const label = (t: string, y: number) => { c.fillStyle = muted; c.font = F(700, 24); c.fillText(t, 64, y); };
  const right = (t: string, x: number, y: number) => { c.textAlign = 'right'; c.fillText(t, x, y); c.textAlign = 'left'; };
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);

  // header in the brand gradient
  const g = c.createLinearGradient(0, 0, W, 260);
  g.addColorStop(0, '#4154F9'); g.addColorStop(0.45, '#7B2FF0'); g.addColorStop(0.78, '#DE1885'); g.addColorStop(1, '#F68D4C');
  c.fillStyle = g; c.fillRect(0, 0, W, 250);
  const icon = await load('/brand/autoprism-icon.png');
  c.fillStyle = '#FFFFFF'; round(c, 64, 52, 104, 104, 28); c.fill();
  if (icon) c.drawImage(icon, 77, 70, 78, 66);
  c.fillStyle = '#FFFFFF'; c.font = F(800, 50); c.fillText(DEALER.name, 196, 102);
  c.font = F(500, 28); c.globalAlpha = 0.92; c.fillText(DEALER.branch + ' · Motor insurance renewal quote', 196, 144); c.globalAlpha = 1;
  c.font = F(600, 26); c.fillText('For ' + d.customer, 64, 214); right('Quote date ' + d.date, W - 64, 214);

  // vehicle and policy
  let y = 318;
  c.fillStyle = ink; c.font = F(800, 42); c.fillText(fit(c, d.vehicle, W - 300), 64, y);
  c.font = F(800, 26); const tw = c.measureText(d.rtype).width + 40;
  c.fillStyle = '#ECEEFE'; round(c, W - 64 - tw, y - 34, tw, 46, 12); c.fill(); c.fillStyle = '#2A37B8'; c.fillText(d.rtype, W - 64 - tw + 20, y - 2);
  y += 48; c.fillStyle = muted; c.font = F(500, 27);
  c.fillText(fit(c, 'New policy ' + d.period + (d.prevIns ? ' · last year with ' + d.prevIns : ''), W - 128), 64, y);

  // recommended plan
  y += 36;
  const gb = c.createLinearGradient(64, y, W - 64, y + 200); gb.addColorStop(0, '#4154F9'); gb.addColorStop(1, '#DE1885');
  c.fillStyle = gb; round(c, 64, y, W - 128, 210, 28); c.fill(); c.fillStyle = '#FFFFFF'; round(c, 68, y + 4, W - 136, 202, 25); c.fill();
  c.fillStyle = '#7B2FF0'; c.font = F(800, 22); c.fillText('RECOMMENDED PLAN', 100, y + 46);
  c.fillStyle = ink; c.font = F(800, 40); c.fillText(fit(c, rec.name, 520), 100, y + 98);
  c.font = F(800, 58); right(inr(rec.total), W - 100, y + 104);
  c.fillStyle = muted; c.font = F(500, 22); right('total payable incl. GST', W - 100, y + 136);
  // key facts strip
  const facts = [['IDV', rec.idv || '—'], ['NCB', rec.ncb || '0%'], ['Add-ons', rec.addons.length ? String(rec.addons.length) : 'None']];
  const fw = (W - 200) / 3;
  facts.forEach((f, n) => {
    const x = 100 + n * fw;
    c.fillStyle = muted; c.font = F(600, 22); c.fillText(f[0], x, y + 168);
    const lw = c.measureText(f[0]).width;
    c.fillStyle = ink; c.font = F(800, 28); c.fillText(fit(c, f[1], fw - lw - 30), x + lw + 12, y + 169);
  });
  y += 250;

  // premium breakup
  label('PREMIUM BREAKUP', y); y += 24;
  rec.lines.forEach((ln, n) => {
    const total = ln.k === 'Total payable', net = ln.k === 'Net premium';
    if (total) { c.fillStyle = '#ECEEFE'; round(c, 64, y + 6, W - 128, 64, 14); c.fill(); }
    else if (n > 0) { c.fillStyle = line; c.fillRect(64, y, W - 128, 2); }
    c.fillStyle = ln.minus ? '#166534' : ink; c.font = F(total || net ? 800 : 500, total ? 32 : 29);
    c.fillText(fit(c, ln.k, 640), total ? 88 : 64, y + 48);
    right(ln.v, total ? W - 88 : W - 64, y + 48);
    y += 70;
  });

  // add-ons included
  if (rec.addons.length) {
    y += 56; label('ADD-ONS INCLUDED', y); y += 22;
    let x = 64; c.font = F(700, 26);
    rec.addons.forEach((a) => {
      const w = c.measureText(a).width + 44;
      if (x + w > W - 64) { x = 64; y += 60; }
      c.fillStyle = '#F0E8FE'; round(c, x, y, w, 48, 24); c.fill(); c.fillStyle = '#6A26D0'; c.fillText(a, x + 22, y + 33);
      x += w + 12;
    });
    y += 68;
  }

  // compare options
  y += 40; label('COMPARE OPTIONS', y); y += 18;
  c.fillStyle = soft; round(c, 64, y, W - 128, 54, 12); c.fill();
  c.fillStyle = muted; c.font = F(700, 22);
  const cx = [88, 440, 600, 720, W - 88];
  c.fillText('Insurer', cx[0], y + 35); c.fillText('IDV', cx[1], y + 35); c.fillText('NCB', cx[2], y + 35); c.fillText('Add-ons', cx[3], y + 35); right('Premium', cx[4], y + 35);
  y += 54;
  d.options.forEach((o) => {
    c.fillStyle = ink; c.font = F(o.pick ? 800 : 500, 27);
    c.fillText(fit(c, o.name, 330), cx[0], y + 46);
    c.fillText(o.idv || '—', cx[1], y + 46); c.fillText(o.ncb || '—', cx[2], y + 46); c.fillText(o.addons.length ? String(o.addons.length) : 'None', cx[3], y + 46); right(inr(o.total), cx[4], y + 46);
    c.fillStyle = line; c.fillRect(64, y + 72, W - 128, 2);
    y += 74;
  });

  // saving and NCB
  if (d.saving) {
    y += 30; c.fillStyle = '#E3F4E8'; round(c, 64, y, W - 128, 80, 20); c.fill();
    c.fillStyle = '#166534'; c.font = F(700, 29); c.fillText(fit(c, d.saving, W - 200), 100, y + 51); y += 74;
  }
  if (d.ncb) { y += 50; c.fillStyle = ink; c.font = F(600, 28); c.fillText(fit(c, d.ncb, W - 128), 64, y); }

  // why renew with us
  y += 60; label('WHY RENEW WITH US', y); y += 30;
  DEALER.perks.forEach((p) => {
    c.fillStyle = '#166534'; c.beginPath(); c.arc(82, y + 10, 16, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 5; c.beginPath(); c.moveTo(74, y + 10); c.lineTo(80, y + 17); c.lineTo(91, y + 3); c.stroke();
    c.fillStyle = ink; c.font = F(500, 28); c.fillText(fit(c, p, W - 200), 116, y + 20); y += 52;
  });

  // footer
  c.fillStyle = soft; c.fillRect(0, H - 120, W, 120);
  c.fillStyle = ink; c.font = F(700, 27); c.fillText(d.caller + ' · ' + DEALER.name, 64, H - 70);
  c.fillStyle = muted; c.font = F(500, 21); c.fillText('Premium as per the insurer on the quote date. Subject to policy terms. Reply on WhatsApp to renew.', 64, H - 34);
  return cv.toDataURL('image/png');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "6 Dec" (the policy end, in the demo year) -> "7 Dec 2026 – 6 Dec 2027" */
function nextPeriod(end: string): string {
  const m = /^(\d{1,2}) ([A-Za-z]{3})/.exec(String(end || ''));
  if (!m) return '';
  const mi = MONTHS.indexOf(m[2]); if (mi < 0) return '';
  const from = new Date(Date.UTC(2026, mi, +m[1] + 1)), to = new Date(Date.UTC(2027, mi, +m[1]));
  const f = (d: Date) => d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  return f(from) + ' – ' + f(to);
}

/** Every option's details, read from the quote editor one option at a time (it shows only the selected one). */
function allOptions(ctx: MobileCtx, v: any): Opt[] {
  const self: any = ctx.self, saved = self.state, k = saved.sel;
  const tabs: any[] = v.qTabs || [];
  const out: Opt[] = [];
  try {
    tabs.forEach((t: any, qi: number) => {
      if (!rupees(t.amt) || /Unsaved/.test(String(t.amt))) return;
      self.state = { ...saved, qtab: { k, qi } };
      const e = (ctx.fresh().ed || {}) as any;
      const live = Array.isArray(e.liveLines) && e.liveLines.length > 0;
      const total = rupees(e.total) || rupees(t.amt);
      const ncbOn = ((e.ncbOpts || []).filter((o: any) => o.on)[0] || {}).label || '';
      const addons = String(live ? e.liveAdd : e.addons || '').split(/\s*,\s*/).filter((x: string) => x && !/^none$/i.test(x));
      const lines: Opt['lines'] = [];
      if (live) {
        (e.liveLines as any[]).forEach((l) => { const add = /^Add-ons/.test(String(l.k)); lines.push({ k: add ? 'Add-on covers (' + addons.length + ')' : String(l.k).replace(/ · IDV .*/, ''), v: add && /^None$/i.test(String(l.v)) && addons.length ? 'Included' : String(l.v), minus: /^−/.test(String(l.v)) }); });
      } else {
        (e.rows || []).forEach((r: any) => { const n = rupees(r.val); if (!n && r.sign) return; lines.push({ k: /^Add-ons/.test(String(r.k)) ? 'Add-on covers (' + addons.length + ')' : String(r.k).replace(/^PA owner-driver$/, 'PA owner-driver cover'), v: (r.sign === '− ' ? '− ' : '') + inr(n), minus: r.sign === '− ' }); });
        lines.push({ k: 'GST 18%', v: inr(rupees(e.gst)) });
      }
      // net premium and total, as on insurer quotes
      const gstLine = lines.filter((l) => /^GST/.test(l.k))[0];
      const gst = gstLine ? rupees(gstLine.v) : 0;
      const at = gstLine ? lines.indexOf(gstLine) : lines.length;
      lines.splice(at, 0, { k: 'Net premium', v: inr(total - gst) });
      lines.push({ k: 'Total payable', v: inr(total) });
      out.push({ name: String(e.title || t.name), total, idv: live ? e.liveIdv : (e.idvVal ? '₹' + (Number(e.idvVal) / 100000).toFixed(2) + ' L' : ''), ncb: live ? e.liveNcb : ncbOn, addons, lines, pick: t.sel === 'true' || t.sel === true });
    });
  } finally { self.state = saved; }
  return out.sort((a, b) => (a.pick === b.pick ? a.total - b.total : a.pick ? -1 : 1));
}

export default function (v: any, ctx: MobileCtx): any {
  const self: any = ctx.self;
  const s = self.state;
  const sel = v.sel || {}, pp = v.pp || {}, send = v.send || {};
  const st = s.mQcard || null;
  const open = !!st && !!v.detailOpen;

  const st0 = s.mQcard || null;
  const options: Opt[] = st0 && v.detailOpen ? allOptions(ctx, v) : [];
  const caller = (/Signed in as ([^,]+)/.exec(String((v.me && v.me.label) || '')) || [])[1] || 'Your advisor';
  const ptype = /OD only/i.test(String(pp.typeLine || '')) ? 'OD only' : /TP only/i.test(String(pp.typeLine || '')) ? 'TP only' : 'OD + TP';
  const save = (/is (₹[\d,]+) lower than last year/.exec(String((options[0] && pp.cmp) || '')) || [])[1];
  const data: CardData = {
    customer: String(sel.name || 'you').replace(/ \+1 vehicle$/, ''),
    vehicle: String(sel.vehicle || ''),
    rtype: ptype, period: nextPeriod(sel.end), prevIns: pp.ins && pp.ins !== 'Not known' ? String(pp.ins) : '',
    options, caller,
    saving: save ? 'You save ' + save + ' compared with last year' : '',
    ncb: sel.ncbNew ? 'Your no-claim bonus: ' + String(sel.ncbNew).split('→').map((x) => (/%$/.test(x.trim()) ? x.trim() : x.trim() + '%')).join(' → ') + ' when you renew on time' : '',
    date: '8 Nov 2026',
  };
  const key = JSON.stringify(data);

  if (open && st && options.length && st.key !== key && !self.__mQcardBusy) {
    self.__mQcardBusy = true;
    draw(data).then((url) => { self.__mQcardBusy = false; if (self.state.mQcard) ctx.set({ mQcard: { key, url } }); })
      .catch(() => { self.__mQcardBusy = false; ctx.set({ mQcard: null, mToast: 'Could not make the quote card.' }); });
  }

  // log it the same way as a text quote: History gets "WhatsApp sent · Quote details" and the lead moves to Quote sent
  const logSent = () => { const f = ctx.fresh(); if (f.send && !f.send.cant) { logShare(ctx, f, 'Quote card', 'WhatsApp'); f.send.open(); const g = ctx.fresh(); if (g.mg && g.mg.send) g.mg.send(); } };
  const fileName = 'Quote ' + data.customer.replace(/[^A-Za-z ]/g, '').trim() + '.png';
  const share = async () => {
    const url = st && st.url; if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: 'Your insurance renewal quote from ' + DEALER.name });
        logSent(); ctx.set({ mQcard: null, mToast: 'Quote card shared. Logged in History.' });
        return;
      }
    } catch (e: any) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    logSent(); ctx.set({ mQcard: null, mToast: 'Quote card saved as an image. Attach it in WhatsApp. Logged in History.' });
  };

  return {
    open, ready: open && !!(st && st.url) && st.key === key, url: (st && st.url) || '',
    cant: !!send.cant, cantLine: String(send.line || ''),
    start: () => {
      if (send.cant) { ctx.note(String(send.line || 'This quote cannot be sent yet') + '.'); return; }
      if (!(v.qTabs || []).some((t: any) => rupees(t.amt) > 0)) { ctx.note('Add a quote with a premium first.'); return; }
      ctx.set({ mQcard: { key: '' } });
    },
    close: () => ctx.set({ mQcard: null }),
    share, shareOff: open && !!(st && st.url) && st.key === key ? '' : '-off',
    layers: [{ id: 'qcard', open, close: () => ctx.set({ mQcard: null }) }],
  };
}
