// Entry point. "/" runs the latest board as the product; "/next" runs the backend-ready screens.
const root = document.getElementById('root')!;

if (location.pathname === '/next' || location.pathname.startsWith('/next/')) {
  void import('./next').then((m) => m.bootNext());
} else {
  void import('../proto/boot').then((m) => m.bootPrototype(root));
}
