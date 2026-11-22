import type { MobileCtx } from '../logic';

/** Branded quote card (m.qcard.*): an image of the quote, made on the phone, shared on WhatsApp. */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Placeholder dealership branding for the sample. Replace with the dealer's own name, branch and logo. */
export const DEALER = { name: 'Autoprism Motors', branch: 'Kukatpally', perks: ['Cashless claims at our workshop', '₹1,000 service coupon when you renew', 'Pay safely by UPI link'] };

const W = 1080, H = 1350;
const ink = '#0B1A47', muted = '#5B6482', line = '#E4E7F2';
const rupees = (t: any) => { const n = parseInt(String(t || '').replace(/[^0-9]/g, ''), 10); return /₹/.test(String(t || '')) && n > 0 ? n : 0; };
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

interface CardData { customer: string; vehicle: string; ends: string; rtype: string; options: { name: string; amt: number; pick: boolean }[]; saving: string; ncb: string; caller: string; date: string }

async function draw(d: CardData): Promise<string> {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  try { await (document as any).fonts.ready; } catch { /* system font */ }
  const F = (w: number, s: number) => w + ' ' + s + 'px Inter, system-ui, sans-serif';
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);

  // header band in the brand gradient
  const g = c.createLinearGradient(0, 0, W, 300);
  g.addColorStop(0, '#4154F9'); g.addColorStop(0.45, '#7B2FF0'); g.addColorStop(0.78, '#DE1885'); g.addColorStop(1, '#F68D4C');
  c.fillStyle = g; c.fillRect(0, 0, W, 300);
  const icon = await load('/brand/autoprism-icon.png');
  c.fillStyle = '#FFFFFF'; round(c, 64, 64, 112, 112, 30); c.fill();
  if (icon) c.drawImage(icon, 78, 84, 84, 70);
  c.fillStyle = '#FFFFFF'; c.font = F(800, 54); c.fillText(DEALER.name, 204, 118);
  c.font = F(500, 30); c.globalAlpha = 0.92; c.fillText(DEALER.branch + ' · Motor insurance renewal', 204, 162); c.globalAlpha = 1;
  c.font = F(600, 26); c.fillText('Quote for ' + d.customer, 64, 248);
  c.textAlign = 'right'; c.fillText(d.date, W - 64, 248); c.textAlign = 'left';

  // vehicle and policy
  let y = 360;
  c.fillStyle = ink; c.font = F(800, 46); c.fillText(fit(c, d.vehicle, W - 128), 64, y);
  y += 54; c.fillStyle = muted; c.font = F(500, 30); c.fillText(d.ends, 64, y);
  c.font = F(800, 26); const tw = c.measureText(d.rtype).width + 40;
  c.fillStyle = '#ECEEFE'; round(c, W - 64 - tw, y - 34, tw, 46, 12); c.fill();
  c.fillStyle = '#2A37B8'; c.fillText(d.rtype, W - 64 - tw + 20, y - 2);

  // options, best first; the chosen one is marked
  y += 50;
  c.fillStyle = muted; c.font = F(700, 24); c.fillText('YOUR OPTIONS', 64, y + 20);
  y += 44;
  d.options.slice(0, 3).forEach((o) => {
    const h = o.pick ? 150 : 112;
    if (o.pick) {
      const gb = c.createLinearGradient(64, y, W - 64, y + h); gb.addColorStop(0, '#4154F9'); gb.addColorStop(1, '#DE1885');
      c.fillStyle = gb; round(c, 64, y, W - 128, h, 26); c.fill();
      c.fillStyle = '#FFFFFF'; round(c, 68, y + 4, W - 136, h - 8, 23); c.fill();
      c.fillStyle = '#7B2FF0'; c.font = F(800, 22); c.fillText('RECOMMENDED', 100, y + 44);
      c.fillStyle = ink; c.font = F(800, 40); c.fillText(fit(c, o.name, 560), 100, y + 100);
      c.textAlign = 'right'; c.font = F(800, 56); c.fillText(inr(o.amt), W - 100, y + 104); c.textAlign = 'left';
    } else {
      c.strokeStyle = line; c.lineWidth = 3; round(c, 64, y, W - 128, h, 22); c.stroke();
      c.fillStyle = ink; c.font = F(600, 34); c.fillText(fit(c, o.name, 560), 100, y + 68);
      c.textAlign = 'right'; c.font = F(700, 38); c.fillText(inr(o.amt), W - 100, y + 70); c.textAlign = 'left';
    }
    y += h + 18;
  });
  c.fillStyle = muted; c.font = F(500, 22); c.fillText('Premiums include GST. The final premium is as per the insurer.', 64, y + 8);

  // saving and NCB
  y += 40;
  if (d.saving) {
    c.fillStyle = '#E3F4E8'; round(c, 64, y, W - 128, 84, 20); c.fill();
    c.fillStyle = '#166534'; c.font = F(700, 30); c.fillText(fit(c, d.saving, W - 200), 100, y + 54);
    y += 104;
  }
  if (d.ncb) { c.fillStyle = ink; c.font = F(600, 30); c.fillText(fit(c, d.ncb, W - 128), 64, y + 30); y += 64; }

  // why renew with us
  c.fillStyle = muted; c.font = F(700, 24); c.fillText('WHY RENEW WITH US', 64, y + 24);
  y += 52;
  DEALER.perks.forEach((p) => {
    c.fillStyle = '#166534'; c.beginPath(); c.arc(82, y + 10, 16, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 5; c.beginPath(); c.moveTo(74, y + 10); c.lineTo(80, y + 17); c.lineTo(91, y + 3); c.stroke();
    c.fillStyle = ink; c.font = F(500, 30); c.fillText(fit(c, p, W - 200), 116, y + 20);
    y += 54;
  });

  // footer
  c.fillStyle = '#F4F5FA'; c.fillRect(0, H - 110, W, 110);
  c.fillStyle = ink; c.font = F(700, 28); c.fillText(d.caller + ' · ' + DEALER.name, 64, H - 50);
  c.textAlign = 'right'; c.fillStyle = muted; c.font = F(500, 24); c.fillText('Reply on WhatsApp to renew', W - 64, H - 50); c.textAlign = 'left';
  return cv.toDataURL('image/png');
}

export default function (v: any, ctx: MobileCtx): any {
  const self: any = ctx.self;
  const s = self.state;
  const sel = v.sel || {}, pp = v.pp || {}, send = v.send || {};
  const st = s.mQcard || null;
  const open = !!st && !!v.detailOpen;

  const options = (v.qTabs || []).map((t: any) => ({ name: t.name, amt: rupees(t.amt), pick: t.sel === 'true' || t.sel === true }))
    .filter((o: any) => o.amt > 0).sort((a: any, b: any) => (a.pick === b.pick ? a.amt - b.amt : a.pick ? -1 : 1));
  const caller = (/Signed in as ([^,]+)/.exec(String((v.me && v.me.label) || '')) || [])[1] || 'Your advisor';
  const ptype = /OD only/i.test(String(pp.typeLine || '')) ? 'OD only' : /TP only/i.test(String(pp.typeLine || '')) ? 'TP only' : 'OD + TP';
  const data: CardData = {
    customer: String(sel.name || 'you').replace(/ \+1 vehicle$/, ''),
    vehicle: String(sel.vehicle || ''),
    ends: sel.end ? 'Current policy ends ' + sel.end + ' 2026' : '',
    rtype: ptype, options, caller,
    saving: (/is (₹[\d,]+) lower than last year/.exec(String(pp.cmp || '')) || [])[1] ? 'You save ' + (/is (₹[\d,]+) lower/.exec(String(pp.cmp))![1]) + ' compared with last year' : '',
    ncb: sel.ncbNew ? 'Your no-claim bonus: ' + String(sel.ncbNew).split('→').map((x) => (/%$/.test(x.trim()) ? x.trim() : x.trim() + '%')).join(' → ') + ' when you renew on time' : '',
    date: '8 Nov 2026',
  };
  const key = JSON.stringify(data);

  if (open && st && st.key !== key && !self.__mQcardBusy) {
    self.__mQcardBusy = true;
    draw(data).then((url) => { self.__mQcardBusy = false; if (self.state.mQcard) ctx.set({ mQcard: { key, url } }); })
      .catch(() => { self.__mQcardBusy = false; ctx.set({ mQcard: null, mToast: 'Could not make the quote card.' }); });
  }

  // log it the same way as a text quote: History gets "WhatsApp sent · Quote details" and the lead moves to Quote sent
  const logSent = () => { const f = ctx.fresh(); if (f.send && !f.send.cant) { f.send.open(); const g = ctx.fresh(); if (g.mg && g.mg.send) g.mg.send(); } };
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
    cant: !!send.cant, cantLine: String(send.line || ''), hasOptions: options.length > 0,
    start: () => {
      if (send.cant) { ctx.note(String(send.line || 'This quote cannot be sent yet') + '.'); return; }
      if (!options.length) { ctx.note('Add a quote with a premium first.'); return; }
      ctx.set({ mQcard: { key: '' } });
    },
    close: () => ctx.set({ mQcard: null }),
    share, shareOff: open && !!(st && st.url) && st.key === key ? '' : '-off',
    layers: [{ id: 'qcard', open, close: () => ctx.set({ mQcard: null }) }],
  };
}
