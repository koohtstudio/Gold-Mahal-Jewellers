# Architecture

## Layers

```
screens (app/, components/)      no data access, no fetch, no storage. Enforced by lint.
   |
hooks (lib/hooks)                useQuery runs a repo call and re-runs it when the repo says something changed
   |
repo (lib/repo)                  Repo interface, one adapter per mode
   |
store + backend                  the whole shop as one validated JSON document
```

The `Repo` interface (`lib/repo/types.ts`) has `RatesRepo`, `PiecesRepo`, `ReservationsRepo`, `JobsRepo`, `OldGoldRepo`, `LayawayRepo`, `BooksRepo`, `SettingsRepo`, `VisitsRepo`, `AuditRepo` and the ports `AuthPort`, `PaymentPort`, `NotifyPort`, `StoragePort`, `AccountantPort`, `RateFeedPort`.

## Adapters

- **mock and demo** share all the logic. `lib/repo/ops.ts` is a set of pure functions over a `StoreDoc` (reserve, mark sold, publish rate, buy old gold and so on). `lib/repo/create.ts` wraps them with validation (Zod, strict), role checks, rate limits and simulated latency. The only difference is the `DocBackend`:
  - `LocalBackend`: `localStorage` plus `BroadcastChannel`, writes serialised with Web Locks.
  - `RemoteBackend`: `/api/demo/doc` in front of one Neon row per room, optimistic concurrency by version, polling every 1.2 seconds for other devices.
  - `MemoryBackend`: tests and the server render.
- **neon** (`lib/repo/neon`) is a stub that throws NotImplemented and names the SQL it will use.

The contract suite in `tests/contract` runs against the mock and the demo adapters today and must pass against Neon before live.

## Money

Integer cents and integer milligrams everywhere. Rounding is half to even (`lib/pricing/money.ts`, mirrored by `div_he` in SQL). Karat rates derive from the 24k rate and are rounded to the cent. Every price is computed from that rounded per gram figure, so a customer with a calculator gets the same number.

## Rendering and the CSP

`proxy.ts` makes a nonce per request. A nonce needs dynamic rendering, so every page is rendered per request (`headers()` in the root layout). The server render uses the seed data so the first paint already has real prices. The browser then loads the real store and updates. Dates and times are only drawn after mount.

## Time

All calendar logic uses America/Toronto (`lib/time.ts`), whatever the visitor's device says.

## Books

`lib/books` builds the summary from ledger rows, expenses and old gold. CSV, a zip writer and a PDF writer are hand written, so downloads need no dependency. ID references are never exported.
