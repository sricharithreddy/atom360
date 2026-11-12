# Autoprism Insurance CRM

Motor insurance renewal CRM for dealer insurance desks. This repository is the real application (React + TypeScript). The clickable design prototype is separate and serves as the spec.

## What works today (milestone 1: telecaller core)

- Sign in with mobile number and PIN, for telecaller, team lead and admin
- Today: summary strip, callback banner, tabs, key filters, grouped queue
- Search across all leads; other people's leads open as view only
- Lead panel: who renewed before, AI flags, masked contact with recorded reveal, quotes with payment-link timer, previous policy, call and outcome, history
- WhatsApp from the caller's own number (opens WhatsApp with the message filled in)
- Ownership, calling rules, allocation, AI pick-up and queue order enforced on the server side, with tests

Not built yet: lead upload, Admin (team, targets, rules, move leads), Stats, Learn, Messages journey, documents, claims, coupons, policy issue after payment.

## Sample data, and what "mock" means

There is no backend yet. With `VITE_API_MODE=mock` (the default) a fake server runs inside the browser and answers the app's network calls. Data is saved in that browser only: two people do not see each other's changes, and clearing site data resets it. The sign-in page lists the sample logins and has a "Reset sample data" button.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm test           # rule tests
npm run build      # type check + production build into dist/
```

## Deploy to Cloudflare (Workers)

1. In Cloudflare, go to Workers & Pages, Create, and import this repository.
2. Build command `npm run build`, deploy command `npx wrangler deploy`. Set the environment variable `NODE_VERSION=22`.
3. Deploy. `wrangler.jsonc` serves `dist` as a single-page app, so links to a lead work after a refresh.

## How the code is laid out

| Folder | What it holds |
| --- | --- |
| `db/schema.sql` | The target Postgres tables. `src/domain/types.ts` mirrors them. |
| `src/rules/` | Business rules as pure functions, with tests. These move to the backend unchanged. |
| `src/api/` | The only place screens talk to the server. See `docs/API.md` for the contract. |
| `src/mock/` | The fake server: sample data, storage in the browser, request handlers. Deleted from the bundle once a real backend exists. |
| `src/features/` | Screens: sign-in, today, lead. |
| `src/styles/app.css` | Design tokens and styles. Sizes are in rem, so density changes in one place. |

## Adding the real backend later

1. Create the database from `db/schema.sql`.
2. Implement the endpoints in `docs/API.md`, reusing `src/rules/`.
3. Set `VITE_API_MODE=real` and `VITE_API_BASE=https://your-api` at build time. No screen changes.
