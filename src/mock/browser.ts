import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** Starts the fake server. Requests the app makes to /api are answered in this browser. */
export async function startMockServer(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true, serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` } });
}
