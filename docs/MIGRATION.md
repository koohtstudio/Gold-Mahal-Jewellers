# Migration notes: mock to demo to live

## Data shape

The mock store holds one document (`StoreDocSchema` in `lib/domain/schemas.ts`). The live schema in `db/migrations/0001_init.sql` has one table per collection. Names map one to one (`oldGold` is `old_gold`, `reservation.lines` is `reservation_lines`).

## Differences to know about

| Document | Live schema |
|---|---|
| Money in cents, weight in milligrams | Same |
| Prices computed in the browser from the latest rate | `v_shop_pieces` computes them in SQL |
| Reservation created by `ops.createReservation` | `create_reservation()` in one transaction, locks the rate |
| Hold expiry checked on a 30 second timer in open tabs | `expire_holds()` from a cron job |
| ID reference masked in the repo | Column not readable by the app role, `reveal_old_gold_id()` |
| Ledger entries written by `ops` | Written by `mark_reservation_sold()` and the layaway and job functions |
| Piece `status` derived from units | Same, derived |

## Moving the sample data

There is nothing to migrate. The seed (`lib/mock/seed.ts`) is sample data. For the real launch, load the real catalogue and settings, not the seed.

## Rolling back

Switch `NEXT_PUBLIC_APP_MODE` back to `demo` or `mock` and redeploy. The live database is untouched by either.
