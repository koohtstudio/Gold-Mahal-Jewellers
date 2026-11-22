# PLAN.md: Gold Mahal Jewellers storefront, admin and books

Status: plan only. No code written yet. Waiting for "go".

Sources read: the design file (boards Main, Mobile, Admin), `CONTENT.md`, the build brief. Where design and `CONTENT.md` disagree, `CONTENT.md` wins. Where the brief and the hard rules disagree with the design copy, the hard rules win (see section 11).

## 0. Changes from the brief (read this first)

| Brief says | Plan does | Why |
|---|---|---|
| Supabase adapter, `supabase/migrations/` | **Neon** adapter, `db/migrations/` (plain SQL for Neon Postgres) | You asked for Neon. Neon is Postgres without PostgREST, so access control moves from RLS-through-REST to server routes plus a restricted DB role. RLS stays in the SQL as defence in depth. |
| `lib/repo/supabase/` stub | `lib/repo/neon/` stub, same interfaces | Same contract suite applies. |
| Supabase Auth, Storage, Realtime | Neon Auth (managed Better Auth), Neon Object Storage (private bucket, presigned URLs), Neon Realtime or polling | Keeps everything on one vendor. Each is behind a port, so swapping is one file. |
| "Components never touch fetch" and `api/` route handlers | In mock mode the data lives in the browser, so route handlers cannot see it. Routes are the **live** surface (reservation create, visit, desk lookup, accountant send, cron). In mock mode the UI goes hooks, then repo, then localStorage, and never calls them | A Vercel function cannot read a visitor's localStorage. Said plainly so it is not a surprise. |
| Data model listed | Additive fields only (section 7). Nothing removed or renamed | Needed for units per tag, images, options, visit requests, valuations, melt tracking. |
| Branch and deploy | Work on branch `build/v1`, push, open a PR into `main`. Vercel gives a preview URL per branch. Production is whatever is on `main` | You asked for preview per branch and production from `main`. I will not push to `main` without your say. |

## 1. Stack and why

- Next.js 16 (App Router, React 19, `proxy.ts` replaces middleware), TypeScript strict, pnpm, Node 22.
- **CSS Modules**, not Tailwind. The design is about 300 lines of hand-tuned CSS (arch frames, lattice, gradient text, ticker mask, admin tables). Porting it near verbatim into scoped modules keeps it faithful and keeps the class strings readable. Tokens live as CSS variables in one `tokens.css` from CONTENT.md section 6. No runtime CSS, no UI kit.
- Zod 4 for every write, route body and the store itself. `.strict()` on write schemas so unknown fields are rejected.
- Vitest 5 (unit, contract). Playwright with `@axe-core/playwright` (e2e, a11y). `lighthouse` as a dev dependency driven by a script.
- Fonts through `next/font/google` (self-hosted at build): Cormorant Garamond 500/600 plus italics, Jost 400/500. No runtime request to Google.
- TypeScript 7 is the newest tag on npm. If it trips Next or typescript-eslint at scaffold time I take the latest 5.x and note it here.
- Lint rule enforces the architecture: `app/**` and `components/**` may not import `localStorage`, `BroadcastChannel`, `fetch`, `@neondatabase/*`. Only `lib/repo/**` and `lib/hooks/**` may. A second script fails the build on em dashes in source, copy and docs.

## 2. Folder layout

```
app/
  (site)/              layout (ticker bar, floating action bar, bag drawer), /, /shop, /shop/[slug],
                       /rate, /trade-in, /visit, /reservation/[code], /policies
  (admin)/admin/       login, layout (sidebar, phone tab bar, banner), then
                       page (dashboard), rate, inventory, reservations, jobs, old-gold, layaway, books, settings
  api/                 live-mode surface only: reservations, visits, valuations, desk/lookup,
                       accountant/send, cron/monthly-books, cron/expire-holds, health
  robots.ts  sitemap.ts  not-found.tsx  error.tsx  opengraph-image (per product)
proxy.ts               nonce CSP, security headers, noindex, admin cookie gate
components/
  site/  admin/  ui/   presentational. Tokens only. No data access.
lib/
  domain/              types + Zod: Rate, Piece, Reservation, Job, OldGoldPurchase, LayawayPlan,
                       LedgerEntry, Expense, AccountantSettings, SendLog, Settings, plus additions
  pricing/             pure: money, rateFor(karat), priceOf(piece, rate), bagTotals, tradeInValue, hst
  books/               ledger builders, period filters, CSV (standard, QuickBooks, Xero), metal ledger,
                       tiny zip writer, tiny PDF writer (no dependencies)
  repo/
    types.ts           all repo and port interfaces
    index.ts           getRepo(): picks adapter by NEXT_PUBLIC_APP_MODE
    contract/          reusable contract suite (runRepoContract(factory))
    mock/              localStorage + BroadcastChannel adapter, mock ports
    neon/              STUB adapter: every method throws NotImplemented with a TODO pointing at the SQL
  hooks/               useRate, usePieces, useBag, useReservations, ... (useSyncExternalStore on repo)
  guards/              honeypot, time-to-submit, rate-limit stub, phone validation
  content/             claims.ts (gated claims), hours, copy constants, review mode
  mock/seed.ts         sample data, generated relative to "now" so every period has rows
  config.ts            reads env, Zod-validates, fails loudly in live mode
db/migrations/         full Neon schema, views, functions, RLS. WRITTEN, NOT APPLIED
docs/                  ARCHITECTURE, SECURITY, MIGRATION, COSTS, CONTENT_TODO, DEMO-SCRIPT, screenshots/
public/images/         the 17 files from photos/ (15 stock plus poster, logo), lattice.svg
tests/                 unit/ e2e/ a11y/
scripts/               lighthouse.mjs, check-dashes.mjs, screenshots.mjs
.github/workflows/ci.yml
TODO-LIVE.md  .env.example  README.md  CONTENT.md  PLAN.md
```

## 3. Pricing rules (all integers)

- Money is integer cents. Weights are integer milligrams (`netGramsMilli`). Making charge is basis points (`makingBps`, 14% is 1400).
- `rateFor(karat)`: 24k is the published rate. 22k, 18k, 14k are `round_half_even(rate24 x karat / 24)` to the cent. The shop shows that rounded per-gram figure, and **every price is computed from the displayed per-gram figure**, so a customer with a calculator reproduces our number.
- `priceOf(piece, rate)`: `gold = roundHE(netMilli x rateKarat / 1000)`, `making = roundHE(gold x makingBps / 10000)`, `total = gold + making + stoneCents`. `fixedCents` pieces skip all of it.
- Gold bars: the premium comes from Settings `barPremiumPct` (default 2) rather than the per-piece making field, so the owner changes it in one place. Bars are `taxFree`.
- HST 13%: `roundHE(taxableSubtotal x 13 / 100)` once per document, on taxable lines only. Rounding is banker's (half to even) at every step. Sample check from CONTENT.md: 22k balis 1.6 g at 208.00 gives gold 305.07, making 42.71, total about $347.78.
- Trade-in: `pureMilli = roundHE(gramsMilli x karat / 24)`, `value = roundHE(pureMilli x rate24 x buyPct / 1000)`. Buy rate defaults to 94% (sample).
- Hold and rate lock: `holdUntil = max(createdAt + holdHours, end of the chosen visit window)`. See open decision 3.
- Lock off (Settings `lockRate`): a reservation reprices at the current rate until it is sold, then freezes.

## 4. Data layer

Interfaces in `lib/repo/types.ts`: `RatesRepo, PiecesRepo, ReservationsRepo, JobsRepo, OldGoldRepo, LayawayRepo, BooksRepo, SettingsRepo` plus ports `AuthPort, PaymentPort, NotifyPort, StoragePort, AccountantPort, RateFeedPort`. I add `VisitsRepo` (visit requests and valuations), `AuditRepo`, and `subscribe(topics, cb)` on the root so hooks can be reactive.

- Every method is async and returns plain serialisable objects validated by Zod on the way in and out.
- `getRepo()` returns the mock adapter when `NEXT_PUBLIC_APP_MODE=mock` (default) and the Neon adapter when `live`. `NEXT_PUBLIC_*` values are inlined at build, so flipping the mode is one env var plus a redeploy.
- Server rendering in mock mode: the mock adapter is read-only seed data on the server. That gives real HTML, Open Graph tags and `generateStaticParams` for the sample products, then the client hydrates from localStorage. `/shop/[slug]` is dynamic with `dynamicParams` on, so a piece the owner adds in admin still deep-links. Not found is decided on the client after the store loads, with a designed empty state.
- Hydration safety: server snapshot is the seed (rate 208.00). After mount the store snapshot replaces it. Price text reserves its width with tabular numerals and `min-width` so CLS stays under 0.05. Date-dependent UI (day picker, "updated at") renders client-only behind skeletons.

### Mock ports

| Port | Mock behaviour |
|---|---|
| PaymentPort | Pay at the store. `charge()` throws "not in v1". |
| NotifyPort | Writes to an in-app Sent log (admin Settings, "Sent messages"). Never contacts anyone. |
| AuthPort | Demo login. Roles `owner` and `staff`. Session is a single cookie `gm_session`. |
| StoragePort | Invoice photos go to IndexedDB (localStorage is too small). Returned as `blob:` URLs. |
| AccountantPort | `send(period, format)` writes the Sent log and the send history. Nothing leaves the browser. |
| RateFeedPort | Returns a drifting sample suggestion. Admin approves or ignores. Never auto-publishes. |

## 5. The mock store

- One versioned document in `localStorage` key `gm-mock-v1` (`{version, createdAt, data}`), validated with Zod on load. Corrupt, wrong version or failing validation: reseed and show a small notice. Never throws.
- Seed is generated relative to now (today, this month, last month, quarter) so the books periods are never empty, including on the 1st of a month. Dates use the shop timezone, America/Toronto.
- Writes are read-modify-write inside one synchronous transaction guarded by the Web Locks API (fallback: a simple storage-event compare-and-retry), so two tabs cannot lose each other's writes.
- Sync: after each commit, post on `BroadcastChannel('gm-mock')`, with a `storage` event fallback. Other tabs re-read and notify subscribers. Target: under one second. Covers rate publish to the shop, reservation to admin Reservations, Dashboard and Inventory, and Ready to the customer's confirmation.
- Holds expire lazily on read and on a 30 second tick in any open tab (live mode uses the Vercel Cron `expire-holds` job).
- Latency: 150 to 400 ms by default, set with `NEXT_PUBLIC_MOCK_LATENCY` (`off` or `min-max`). Playwright runs with `off`.
- "Reset demo data": admin Settings and sidebar, confirm dialog, reseed, broadcast.
- Banners: dismissible per session (sessionStorage) on admin, and a note on the reservation confirmation.
- Cart lives in localStorage `gm-bag`, not a cookie. The only cookie in the whole app is the mock session.

**Limit to know about:** localStorage is per browser on per device. A reservation made on a phone does not appear in an admin opened on a laptop. Two tabs in the same browser work. See open decision 1.

## 6. Routes

Public: `/` (one page like the design, with the anchors), `/shop` (filters via `?cat=`), `/shop/[slug]` (full page plus the same modal content, Open Graph, JSON-LD product marked sample), `/rate` (calculator), `/trade-in` (estimator and valuation request), `/visit` (hours, map placeholder, booking), `/reservation/[code]` (status page, needs code plus last 4 of the phone, shows Ready live), `/policies` (shop rules, sample, confirm). Footer and nav link only to these, so no dead ends.

Admin: `/admin/login`, `/admin`, `/admin/rate`, `/admin/inventory`, `/admin/reservations` (tabs: Reservations, Visit requests, Valuations), `/admin/jobs`, `/admin/old-gold`, `/admin/layaway`, `/admin/books`, `/admin/settings` (also Sent messages and Audit log for the owner). Phone: bottom tab bar Dashboard, Reservations, Inventory, Books, More. More is a sheet with Gold rate, Jobs, Old gold, Layaway, Settings, Reset demo data.

Role gating: `owner` sees everything. `staff` cannot see Books, Settings, the Gold rate publish button or ID references on old gold. Enforced in the proxy cookie check, the layout, and again inside the repo (the contract suite tests this).

API (live surface, thin: validate, call repo, return JSON): `POST /api/reservations`, `POST /api/visits`, `POST /api/valuations`, `POST /api/desk/lookup`, `POST /api/accountant/send`, `GET /api/cron/monthly-books`, `GET /api/cron/expire-holds`, `GET /api/health`. In mock mode they return 501 with a clear message and are unit tested for validation only.

## 7. Domain: what I add to the model

Additive only. Everything in the brief stays as written.

- `Piece`: `units` (default 1), `unitsReserved`, `unitsSold`, `image`, `description`, `optionLabel`, `options[]`, `fixedCents` stays optional, `weightGrossMilli?`. Status in case, reserved, sold is derived from units.
- `Reservation.lines[]`: `{ pieceId, qty, option, unitCents }`. Plus `createdAt`, `readyAt`, `soldAt`.
- New `VisitRequest` (`type, preferredDate, name, phone, status`) and `ValuationRequest` (`karat, gramsMilli, estimateCents, name, phone, visitAt?`). Both saved to admin only.
- `OldGoldPurchase`: `awaitingMelt`, `meltedAt?`. `idRef` is admin-owner only.
- `Expense`: `hstCents` is stored, defaulted by category (Insurance 0, rest 13%), editable. Optional `metalKarat` and `metalGramsMilli` on Gold purchase bills so the metal ledger can count supplier grams.
- `LedgerEntry.ref` is the reservation code, invoice no. or plan id. A reservation with both jewellery and a bar creates two entries (`reservation` and `bullion`) so Books splits them.
- `AuditEntry`: `{ id, at, actor, action, target, meta }`. Written on rate publish, sold, release, every old gold ID view, every export and every accountant send.
- `Session`: `{ role, email }`.

## 8. Books

- Periods: this month, last month, quarter to date (calendar quarter, confirm fiscal year end).
- KPIs: jewellery sales before HST, bullion sales (HST exempt, flagged confirm), HST collected, purchases and expenses with HST paid (ITC), HST to remit. Always computed from the ledger and expenses, never hard coded.
- Sources: sold reservations, counter sales (new "Sell at counter" action on an inventory piece), bullion, layaway payments (each payment is a ledger row, HST recognised when paid, flagged as an accountant question), job deposits. Released and expired reservations never reach the ledger.
- Metal ledger by karat: grams in (supplier bills with grams plus old gold) and out (sold pieces and bars).
- Downloads are real client-side Blobs, UTF-8 with BOM, ISO dates, money to 2 decimals. Standard, QuickBooks ready and Xero ready column layouts. PDF summary and the "Full accountant pack" (a .zip of all CSVs plus a summary) come from small hand-written writers, so no dependency is added.
- Invoice photo: attach on the expense form through `StoragePort`.
- Send: one big button "Send [period] books to [first name]" calls `AccountantPort.send`. Writes Sent log, send history and audit. The seeded accountant is an obviously fake placeholder (`accountant@example.com`), because the design's sample name and domain look like a real firm.
- Disclaimer on the page and in every export: a working summary for the accountant, not tax advice.

## 9. Security and privacy (in force in mock mode too)

- `proxy.ts`: per-request nonce, `Content-Security-Policy` with `default-src 'self'`, `script-src 'self' 'nonce-...' 'strict-dynamic'`, `img-src 'self' blob:`, `font-src 'self'`, `style-src 'self' 'nonce-...'`, `style-src-attr 'unsafe-inline'` (progress bars and CSS variables), `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`. Also `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (everything off), HSTS. A nonce CSP makes pages render per request. That is fine here because the data comes from the client store, but I will confirm Lighthouse is still 95+.
- Admin always sends `X-Robots-Tag: noindex`. Public site is `noindex, nofollow` (meta, header, robots.txt) until `NEXT_PUBLIC_ALLOW_INDEXING=true`.
- Zod `.strict()` on every write and route. Honeypot field, minimum time-to-submit, in-memory rate limit stub on reservation, visit, valuation and desk lookup.
- Old gold ID references: owner only, masked by default, reveal writes an audit row, retention rules and the dealer recordkeeping questions go in `docs/SECURITY.md` as questions for the owner and accountant, not as legal claims. Live ID images only in a private bucket.
- No analytics, no pixels, no third-party scripts, no external image hosts. Newsletter is opt-in only with a clear CASL consent line, off by default.

## 10. Neon live path (written now, applied later)

Nothing is applied to any Neon project during this build unless you say so (open decision 4).

- `db/migrations/0001_init.sql` creates: `profiles, rates, pieces, reservations, reservation_lines, jobs, old_gold, layaway, layaway_payments, ledger_entries, expenses, accountant_settings, send_log, settings, visit_requests, valuation_requests, audit_log`. Money as `integer` cents, weights `integer` milligrams.
- `v_shop_pieces` view joins the latest rate and computes the price in SQL, so shop prices cannot drift from the formula. A `shop_reader` role gets `SELECT` on that view only.
- `create_reservation(...)` is a SQL function: locks the piece rows, checks units, reads the latest rate, writes the reservation and lines with `lockedRate24Cents`, and returns the code, all in one transaction. The route handler calls it with the service role. Codes are unique with a retry. Desk lookup is rate limited.
- Authorisation: server routes check the Neon Auth session, then look up the role in `profiles`. RLS is also written (owner and staff policies, no public table access) as a second layer, usable if the Data API is switched on later.
- Storage: Neon Object Storage, private bucket, presigned URLs that expire. Fallback if it does not fit: Vercel Blob private.
- Live updates for the admin: Neon Realtime live queries if they fit, else a 5 second poll behind the same `subscribe` interface.
- Cron: `vercel.json` schedules `expire-holds` (every 15 minutes) and `monthly-books` (1st of the month). Both are idempotent with a run log table.
- Email and SMS: Resend for the books zip, an SMS provider for texts, both behind ports. Stripe Checkout hosted by Stripe is the only payment path, optional, deposits only.
- `.env.example` documents every variable. `live` mode with missing keys throws at startup (`instrumentation.ts` plus `config.ts`).
- `docs/COSTS.md`: I will pull current Neon, Vercel, Resend and SMS pricing when I write it rather than quote from memory, and include the Shopify alternative honestly.
- Optional check: apply the migrations to a throwaway Neon branch with the connector to prove the SQL runs. Needs your OK.

## 11. Content and claims

- Every product, weight, price, review count and hour is sample or `[confirm]`. `[confirm]` shows only with `?review=1`.
- The design copy has claims the hard rules forbid until the owner confirms: "GRA certified moissanite and diamonds", "Certified stones", "natural diamond, certificate shown in store", "we weigh and test everything", "Ultrasonic clean". I gate each in `lib/content/claims.ts` with `confirmed: false`. Unconfirmed copy renders neutral wording ("Diamonds and moissanite. Ask in store about certificates."). Flip one flag per claim after the owner says yes. All listed in `docs/CONTENT_TODO.md`.
- Reviews: show the 5.0 and 17 as `[confirm]`, no quotes. The design's placeholder cards stay as "Real reviews go here".
- `poster.jpg` and `logo.jpg` come from @goldmahal_jewellers on Instagram and need permission. The 15 stock photos are Unsplash placeholders. Both flagged in `CONTENT_TODO.md`. Only files from `photos/` are used. `bracelet-diamond.jpg` is spare.
- Phone and address conflict (905 913-1212 and Unit 27 versus 647 291 2461 and Unit 56): site uses the Google Maps pair, flagged.
- No em dashes anywhere. Enforced by `scripts/check-dashes.mjs` in `pnpm lint`.

## 12. Real versus faked

| Real in this build | Faked (mock port) |
|---|---|
| Pricing, HST, rounding, trade-in maths | Backend: browser localStorage |
| Reserve flow, codes, hold expiry, locked rate | Cross-device sync (same browser only) |
| Cross-tab sync in one browser | Texts and emails (Sent log only) |
| Role gating, honeypot, CSP and headers | Accountant send (history only) |
| Books, ledger, metal ledger, CSV, zip, PDF | Payments (pay at the store) |
| Downloads (real files) | Market rate feed (drifting sample) |
| Zod validation everywhere | Label printing, SMS delivery, invoice storage (IndexedDB) |
| Neon schema, view and function SQL (written) | Applying that SQL |

## 13. Tests and gates

- Vitest: pricing (karat rates, formula, making, stone, fixed, bar premium, HST and exemption, half-even rounding), trade-in, hold expiry, bag math, Zod schemas, phone validation, books (ledger build, period filters, HST to remit, CSV escaping and BOM, metal ledger, released holds excluded), role gating, and `runRepoContract` against the mock. The same suite is pre-wired for the Neon adapter (skipped until it exists).
- Playwright (chromium, latency off): reserve happy path, reservation appears in a second tab, rate publish moves shop prices, Ready shows on the confirmation, reserved and sold piece handling, old gold payout blocked without ID check, layaway payment reaches books, CSV content, Send adds history, role gating, Reset demo data, corrupt storage recovers, link crawler (public and admin, fails on 404 and console errors), axe on every page at 390 and 1440.
- Lighthouse mobile 95+ on home, shop, product, visit, CLS under 0.05, via `scripts/lighthouse.mjs`, numbers reported in the final message.
- CI: GitHub Actions on every push runs typecheck, lint, test, build, e2e. No secrets committed.
- Viewports checked: 360, 390, 768, 1280, 1440. Reduced motion stops the ticker. 44px targets, visible focus, dark gold token for gold on cream.

## 14. Build order (each step ends with its checks green)

1. Scaffold: Next, tokens, fonts, lint rules, CI, copy `photos/`, `proxy.ts`, config.
2. `lib/pricing`, `lib/domain`, `lib/guards` with tests.
3. Repo types, mock adapter, seed, contract suite, hooks, cross-tab sync.
4. Public site: top bar and ticker, hero, rate and calculator, shop, piece modal and `/shop/[slug]`, bag and reserve flow, trade-in, services and visit modal, story, reviews, footer, floating bar. Phone pass.
5. Admin shell, login, banner, dashboard, gold rate, inventory.
6. Reservations (with visits and valuations), jobs, old gold, layaway.
7. Books, exports, accountant card and send.
8. Settings, audit and Sent logs, reset, empty, loading and error states.
9. Neon: migrations, view, function, stub adapter, `TODO-LIVE.md`, `MIGRATION.md`, `COSTS.md`, `SECURITY.md`.
10. E2E, axe, crawler, Lighthouse fixes, screenshots, `DEMO-SCRIPT.md`, `CONTENT_TODO.md`, README.
11. Push branch, preview deploy through the Vercel connector, check it, report URL.

## 15. Risks

1. **Cross-device demo.** Your "done means" has the owner reserving on a phone and then using admin on a laptop. With localStorage that will not carry over. Needs a decision (below).
2. **Claims gating** will make some design copy blander until the owner confirms. Deliberate.
3. **Nonce CSP and caching.** Per-request nonces disable static caching. Mitigation: small server payload, client store. I will measure and fall back to a hash-based policy for static pages if Lighthouse suffers.
4. **TypeScript 7 and tooling** may not be supported by every plugin yet. Fallback to 5.x.
5. **HST treatment** of bullion, trade-ins, layaway timing and insurance is shown as sample and flagged. I do not assert tax rules.
6. **Hold versus visit day.** A 48 hour hold and an 8 day picker do not fit together (open decision 3).
7. **Scope.** This is large. The build order above keeps every step shippable so a partial result is still coherent.
8. **Tooling access.** Pushing needs the `koohtstudio` GitHub login (present) and, for workflow files, the `workflow` scope. Deploying needs the Vercel connector to be connected to this account and the GitHub repo. I will check both at the end of step 1, not at the end of the build.
9. **Fonts at build time** need network access to Google Fonts once. Fine on Vercel and locally.

## 16. Decisions I need from you

1. **Cross-device demo.** (a) Keep pure mock. You or the owner run the story in one browser with two tabs. Simplest, and what the brief literally asks. (b) Add an optional shared demo mode backed by a Neon database through the connector, so phone and laptop see the same data. It uses the real Neon adapter early, so it is extra work and it makes the Neon schema real. My recommendation is (a) for this build, with (b) as the next step, but the owner story you described only works across devices with (b).
2. **Branch and merge.** OK to push `build/v1`, open a PR, and leave `main` to you? Or push straight to `main`?
3. **Hold rule.** Default I chose: hold ends at the later of 48 hours and the end of the visit window, with the rate locked until then. Alternative: restrict the picker to days inside the hold window.
4. **Neon.** OK to use the connector later to apply the migrations to a throwaway branch purely to check the SQL? Nothing is created until you say yes.

## 17. Definition of done

Deployed Vercel URL, short summary, Lighthouse numbers, open items from `docs/CONTENT_TODO.md`, and an honest list of what I could not do. Switching to `live` is then env vars plus filling in `lib/repo/neon/`.


## Build notes (added after "go")

What was decided or changed while building. The plan above is otherwise what was built.

- **Demo mode added** (`NEXT_PUBLIC_APP_MODE=demo`) so the phone to laptop story works across devices. It keeps the same screens and the same operations code as mock mode, but the one JSON document lives in a Neon row per room (`demo_rooms`) behind `/api/demo/doc`, with optimistic concurrency and 1.2 second polling. It is a sample data sandbox with no sign in. The relational schema stays written and not applied.
- **Neon replaces Supabase** everywhere: `db/migrations/0001_init.sql` (tables, `v_shop_pieces`, `create_reservation`, `mark_reservation_sold`, `expire_holds`, `reveal_old_gold_id`, RLS and column privileges) was tested on a throwaway local Postgres with `scripts/check-migration.sh`.
- **Zod loads on first write**, not at page start, to keep startup JavaScript small. Reads use a quick shape check. Writes are fully validated.
- **Hold rule**: a hold ends at the later of the hold hours and the end of the visit window.
- **Branching**: work is on `build/v1` with a PR into `main`. Production on Vercel was deployed from the CLI so the owner has a public link before the merge. `main` is untouched until the PR is merged.
- **Two additions to the route list**: `/reservation/[code]` (customer status page) and `/policies`.
- **Claims** are gated in `lib/content/claims.ts`, all off.
