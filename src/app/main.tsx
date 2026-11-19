// Entry point. "/" runs the latest board as the product; "/next" runs the backend-ready screens.
// On a computer, "/" also gets a Desktop / Mobile switch; Mobile shows the phone layout in a phone frame.
const root = document.getElementById('root')!;

if (location.pathname === '/next' || location.pathname.startsWith('/next/')) {
  void import('./next').then((m) => m.bootNext());
} else {
  void Promise.all([import('../proto/boot'), import('../demo/switcher')]).then(([boot, demo]) => {
    boot.bootPrototype(root);
    if (demo.inFrame) demo.markFrame();
    else demo.mountSwitcher(root);
  });
}
