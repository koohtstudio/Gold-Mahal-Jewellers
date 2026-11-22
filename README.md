# Gold Mahal Jewellers

A pitch build for Gold Mahal Jewellers, a 22k gold, diamond and moissanite jeweller at 6121 Mayfield Rd #27, Brampton, ON. Trust Purity Value.

A public site where every price comes from today's gold rate, with reserve for pickup, an old gold trade-in estimator and visit booking. Behind it, a jeweller admin (rate, weight based inventory, reservations, custom jobs and repairs, old gold purchases, layaway) and books with a one tap send to the accountant.

Everything is sample data. Nothing is charged, texted or emailed, and nothing is sent to a real accountant.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000, mock mode, data saved in your browser
```

| Command | What it does |
|---|---|
| `pnpm typecheck` | TypeScript, strict |
| `pnpm lint` | ESLint plus a check that no em or en dashes sneak into copy or docs |
| `pnpm test` | Vitest: pricing, time, guards, books, the repo contract suite on the mock and demo adapters |
| `pnpm test:e2e` | Playwright: flows, two tab sync, axe on every page at phone and desktop size, link crawler |
| `pnpm lighthouse` | Lighthouse mobile on home, shop, product and visit (needs a running build, see the script) |
| `pnpm screenshots` | Captures the screenshots in `docs/screenshots` |
| `scripts/check-migration.sh` | Loads the Neon schema into a throwaway local Postgres and runs `db/tests/smoke.sql` |

Open the admin at `/admin`. Pick the owner or counter staff demo account. No password.

## Modes

`NEXT_PUBLIC_APP_MODE` is baked in at build time. Changing it needs a rebuild or redeploy.

| Mode | Data lives in | Use it for |
|---|---|---|
| `mock` (default) | This browser (`localStorage`, key `gm-mock-v1`). Two tabs of one browser stay in sync with a `BroadcastChannel`. | Local work, tests, a quick look |
| `demo` | One row per "room" in a Neon Postgres table (`demo_rooms`). Every device that opens the link sees the same data. | The pitch: owner reserves on her phone, then opens the admin on a laptop |
| `live` | The relational Neon schema in `db/migrations`. The adapter in `lib/repo/neon` is a stub. | Later. See `TODO-LIVE.md` |

Demo mode is a sample data sandbox. It has no real sign in, so never put real customer or business data in it. `?room=name` on any URL switches that device to a private room. Reset demo data (admin sidebar or Settings) puts the sample data back for everyone in the room.

## Environment variables

See `.env.example`. In `demo` mode the only secret is `DATABASE_URL` (a Neon pooled connection string). In `live` mode a missing key stops the app at startup (`instrumentation.ts`).

## Deploy to Vercel

1. Push to GitHub. Vercel builds every branch as a preview and `main` as production.
2. In the Vercel project set `NEXT_PUBLIC_APP_MODE=demo`, `DATABASE_URL`, `NEXT_PUBLIC_DEMO_ROOM=pitch` and leave `NEXT_PUBLIC_ALLOW_INDEXING=false`.
3. Run `db/demo/001_demo_rooms.sql` on the Neon database once, or let the first request create the table.
4. Redeploy after changing any `NEXT_PUBLIC_` value.

## What is real and what is faked

| Real | Faked |
|---|---|
| Rate to price maths, HST, rounding, trade-in value | Texts and emails: they go to the Sent messages log in Settings |
| Reserve flow, codes, locked rate, hold expiry, slot capacity | Accountant send: it writes the send history and the log |
| Sync between tabs, and between devices in demo mode | Payments: customers pay at the store |
| Roles, honeypot, time check, rate limits, CSP and security headers | Market rate suggestion: a drifting sample, never auto published |
| Books, metal ledger, CSV, zip and PDF downloads | Label printing and the map |
| Zod validation on every write | Invoice and product photos are stored in this browser (IndexedDB) |
| Neon schema, view and functions (written, tested locally, not applied) | Real sign in: demo accounts only |

## Where things are

`app/` routes, `components/` screens, `lib/pricing` and `lib/books` pure logic, `lib/repo` the data layer (one interface, three adapters), `lib/demo` the demo room server, `db/` SQL, `docs/` the rest. Start with `docs/ARCHITECTURE.md`.
