# Autoprism Insurance CRM

Motor insurance renewal CRM for dealer insurance desks. This repository is the real application (React + TypeScript). The clickable design prototype is separate and serves as the spec.

## What production runs

The live app at `/` is the latest design board, `prototype/V35.dc.html`, run exactly as designed by a small engine in `src/proto/`. It has every section: Today, lead panel, Stats, Learn, Admin and Messages. It runs on sample data held in memory, so a page reload starts fresh.

To ship a newer board: add the file under `prototype/` and change the one import in `src/proto/boot.ts`.

## Phones

On a screen narrower than 900 px the same board runs with a phone layout: bottom tabs, a full-screen lead page with the call actions at the thumb, and sheets for filters, call outcome and messages. It uses the board's own logic and sample data, so both layouts always behave the same. The layout lives in `src/mobile/`; the plan behind it is in `docs/MOBILE.md`.

After shipping a newer board, run `npm test`: it lists any value the phone layout uses that the new board renamed or removed.

## The backend-ready screens

`/next` serves the screens rebuilt on the API layer (sign-in, Today, lead panel, call outcomes, quotes). They are behind the board in features and look. Each section moves from the board to this foundation over time, without changing how it looks. Its sample logins and reset button are on the `/next` sign-in page; its data is saved in the browser.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm test           # rule tests and the phone layout check
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
| `prototype/` | The design board that production runs. |
| `src/proto/` | The engine that runs the board as a React app. |
| `src/mobile/` | The phone layout for the board: template parts, styles, and a thin layer over the board's logic. |
| `src/features/` | Backend-ready screens served under `/next`: sign-in, today, lead. |
| `src/styles/app.css` | Design tokens and styles. Sizes are in rem, so density changes in one place. |

## Adding the real backend later

1. Create the database from `db/schema.sql`.
2. Implement the endpoints in `docs/API.md`, reusing `src/rules/`.
3. Set `VITE_API_MODE=real` and `VITE_API_BASE=https://your-api` at build time. No screen changes.
