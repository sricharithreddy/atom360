// Desktop / Mobile switch for demos on a computer.
// "Mobile" shows the phone layout inside a phone frame. The frame is an iframe of this same app
// (`?frame=1`), so the phone layout runs exactly as it does on a real phone, with its own state.
// On a real phone (narrower than 900 px) none of this shows: the phone layout runs full screen.
import './switcher.css';

const FRAME_W = 390;
const FRAME_H = 844;

/** True inside the phone frame. */
export const inFrame = new URLSearchParams(location.search).get('frame') === '1';

const ICON_DESKTOP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8M12 16v4"></path></svg>';
const ICON_PHONE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.5"></rect><path d="M11 18h2"></path></svg>';
const ICON_BACK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>';
const ICON_RESTART = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path></svg>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function toggle(): { root: HTMLElement; desk: HTMLButtonElement; mob: HTMLButtonElement } {
  const root = el('div', 'dv-toggle');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Choose the view');
  const desk = el('button', 'dv-opt', ICON_DESKTOP + '<span>Desktop</span>');
  const mob = el('button', 'dv-opt', ICON_PHONE + '<span>Mobile</span>');
  desk.type = 'button'; mob.type = 'button';
  root.append(desk, mob);
  return { root, desk, mob };
}

/** Called on the main page (not inside the frame). */
export function mountSwitcher(app: HTMLElement): void {
  const wide = window.matchMedia('(min-width: 900px)');
  let view: 'desktop' | 'mobile' = new URLSearchParams(location.search).get('view') === 'mobile' ? 'mobile' : 'desktop';

  // Floating switch over the desktop app (bottom of the left rail).
  const dock = toggle();
  dock.root.classList.add('dv-dock');

  // The demo stage: toolbar and phone frame.
  const stage = el('div', 'dv-stage');
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-label', 'Mobile view');
  const bar = el('div', 'dv-bar');
  const top = toggle();
  const tools = el('div', 'dv-tools');
  const back = el('button', 'dv-tool', ICON_BACK + '<span>Back</span>');
  back.type = 'button'; back.title = 'Same as the Back button on a phone';
  const restart = el('button', 'dv-tool', ICON_RESTART + '<span>Restart demo</span>');
  restart.type = 'button'; restart.title = 'Start the phone again with fresh sample data';
  tools.append(back, restart);
  bar.append(top.root, tools);

  const fit = el('div', 'dv-fit');
  const phone = el('div', 'dv-phone');
  const screen = el('div', 'dv-screen');
  const status = el('div', 'dv-status', '<span>1:10</span><span class="dv-cam" aria-hidden="true"></span><span class="dv-icons" aria-hidden="true"><i></i><i></i><b></b></span>');
  status.setAttribute('aria-hidden', 'true');
  let frame: HTMLIFrameElement | null = null;
  screen.append(status);
  phone.append(screen);
  fit.append(phone);
  const note = el('p', 'dv-note', 'Phone layout, ' + FRAME_W + ' × ' + FRAME_H + '. On a real phone the site opens like this, full screen.');
  stage.append(bar, fit, note);
  document.body.append(dock.root, stage);

  function ensureFrame(): HTMLIFrameElement {
    if (frame) return frame;
    frame = document.createElement('iframe');
    frame.className = 'dv-iframe';
    frame.title = 'Autoprism on a phone';
    frame.src = '/?frame=1';
    screen.append(frame);
    return frame;
  }

  function scale(): void {
    const availW = window.innerWidth - 48;
    const availH = window.innerHeight - bar.offsetHeight - note.offsetHeight - 48;
    const s = Math.min(1, availW / (FRAME_W + 24), availH / (FRAME_H + 24));
    phone.style.transform = 'scale(' + s.toFixed(3) + ')';
    fit.style.width = Math.round((FRAME_W + 24) * s) + 'px';
    fit.style.height = Math.round((FRAME_H + 24) * s) + 'px';
  }

  function render(): void {
    const show = wide.matches;
    const mobile = show && view === 'mobile';
    dock.root.hidden = !show || mobile;
    stage.hidden = !mobile;
    document.documentElement.classList.toggle('dv-mobile', mobile);
    app.inert = mobile;
    if (mobile) app.setAttribute('aria-hidden', 'true'); else app.removeAttribute('aria-hidden');
    for (const t of [dock, top]) {
      t.desk.setAttribute('aria-pressed', String(view === 'desktop'));
      t.mob.setAttribute('aria-pressed', String(view === 'mobile'));
    }
    if (mobile) { ensureFrame(); scale(); }
  }

  function choose(v: 'desktop' | 'mobile'): void {
    view = v;
    const url = new URL(location.href);
    if (v === 'mobile') url.searchParams.set('view', 'mobile'); else url.searchParams.delete('view');
    history.replaceState(history.state, '', url.toString());
    render();
    (v === 'mobile' ? top.mob : dock.mob).focus({ preventScroll: true });
    if (v === 'desktop') dock.desk.focus({ preventScroll: true });
  }

  for (const t of [dock, top]) {
    t.desk.addEventListener('click', () => choose('desktop'));
    t.mob.addEventListener('click', () => choose('mobile'));
  }
  back.addEventListener('click', () => { try { frame?.contentWindow?.history.back(); } catch { /* ignore */ } });
  restart.addEventListener('click', () => { if (frame) frame.src = '/?frame=1&r=' + Date.now(); });
  window.addEventListener('resize', () => { if (!stage.hidden) scale(); });
  wide.addEventListener('change', render);
  render();
}

/** Called inside the phone frame. */
export function markFrame(): void {
  document.documentElement.classList.add('dv-in-frame');
}
