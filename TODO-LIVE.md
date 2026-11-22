# From demo to live, in order

The screens do not change. Work is in `lib/repo/neon`, the server routes and the account setup.

1. **Owner decisions.** Work through `docs/CONTENT_TODO.md`. Real catalogue, hours, phone and address, accountant details, which claims are allowed.
2. **Neon project.** Create the production project and branch. Apply `db/migrations/0001_init.sql`. Create a login role for the server and `grant app_server to` it. Create a read only login for the shop and `grant shop_reader to` it. Insert the single `settings` and `accountant_settings` rows.
3. **Auth.** Set up Neon Auth (managed Better Auth). Create the owner and staff users and their `profiles` rows. Replace the cookie in `lib/repo/ports.ts` and the check in `proxy.ts` with a verified session. After verifying, each request sets `app.user_id` and `app.role` inside its transaction.
4. **Neon adapter.** Fill in `lib/repo/neon`, one area at a time, until `tests/contract` passes against it: rates, pieces (read through `v_shop_pieces`), reservations (`create_reservation`, `mark_reservation_sold`, `expire_holds`), jobs, old gold (`reveal_old_gold_id`), layaway, books, settings, visits, audit.
5. **Server routes.** The routes in `app/api` become the only write path. Add the honeypot, time check and rate limit from `lib/guards` in front of each public route.
6. **Storage.** Private object storage for invoice photos, product photos and ID images. Short lived signed URLs. Nothing public.
7. **Texts and email.** Pick an SMS provider and Resend. Fill the notify and accountant ports. Register for Canadian SMS sending if the provider needs it. Add the unsubscribe wording the law needs.
8. **Cron.** `vercel.json` entries for `expire-holds` every 15 minutes and `monthly-books` on the 1st. Protect both with `CRON_SECRET`. Both are idempotent (`cron_runs` and `send_log` unique keys).
9. **Realtime for the admin.** Neon Realtime live queries, or a 5 second poll behind `subscribe`.
10. **Rate feed.** Choose a market data source. It only ever suggests. The owner approves.
11. **Photos and claims.** Replace the stock photos, get permission for the poster and logo, flip each flag in `lib/content/claims.ts` the owner approves.
12. **Launch.** Set `NEXT_PUBLIC_APP_MODE=live`, `NEXT_PUBLIC_ALLOW_INDEXING=true` and `NEXT_PUBLIC_SITE_URL`. Run the full test suite against a staging copy. Check Lighthouse. Back up, then go.
