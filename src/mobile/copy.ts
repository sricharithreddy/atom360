import type { MobileCtx } from './logic';

/** Copy to the clipboard (with a fallback for browsers that block it) and say so. */
export function copyText(ctx: MobileCtx, text: string, done: string, key: string): void {
  if (!text) return;
  const ok = () => {
    ctx.set({ mCopied: key, mToast: done });
    setTimeout(() => { if (ctx.self.state.mCopied === key) ctx.set({ mCopied: '' }); }, 2000);
  };
  const fallback = () => {
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); ok();
    } catch { ctx.note('Could not copy. Press and hold the number to copy it.'); }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  } catch { fallback(); }
}

