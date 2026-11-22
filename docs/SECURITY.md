# Security and privacy

## In force today

- `proxy.ts`: a CSP with a per request nonce and `strict-dynamic`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (everything off), `frame-ancestors 'none'`, `X-Frame-Options`, HSTS over https. Images and fonts from this site only. No third party scripts, images or analytics.
- Zod on every write, strict, so unknown fields are rejected.
- Honeypot field, a time to submit check and a rate limiter on reservations, visits, valuations and desk lookup.
- Roles: the owner sees everything. Counter staff cannot see the books, settings, audit log, sent messages or ID references, and cannot change the rate. Enforced in the proxy, the screens and the repo.
- Audit log: rate changes, reservations marked sold, old gold ID views, exports and accountant sends.
- No cookies except the demo sign in (`gm_session`). The reserve bag is in `localStorage`.
- Public site is `noindex, nofollow` until `NEXT_PUBLIC_ALLOW_INDEXING=true`. The admin and the API are always noindex.
- No card data touches this app. Online payment, if added, uses Stripe Checkout hosted by Stripe.

## Demo mode warning

Demo mode (`NEXT_PUBLIC_APP_MODE=demo`) stores the sample data in a Neon row that any visitor can read and write through `/api/demo/doc`. The route validates the shape, caps the size, rate limits by address and caps the number of rooms, but it has no sign in. It is for sample data only. Do not enter real customer, ID or accounting data. Live mode replaces it.

## Old gold records

Buying old gold records the seller's name, weight, price and an ID reference.

- Admin only. In the live schema the app role cannot read the `id_ref` column at all. The owner reads it through `reveal_old_gold_id()`, which writes an audit row.
- ID images, if kept, go in a private bucket with short lived signed URLs. Never public.
- Exports never include ID references.
- A row cannot exist without the "photo ID checked" flag (a database check).

### Retention and dealer records: questions, not answers

Precious metal dealers may have recordkeeping and reporting duties. These are questions for the owner and the accountant, not statements of the law:

1. What must be recorded when buying old gold, and for how long must the records be kept?
2. When is a photo of the ID required, and how long may it be kept?
3. Are there reporting thresholds for cash purchases or large transactions?
4. What privacy notice must the shop give the people it records?
5. Who may see the records, and what must happen when someone asks to see or delete theirs?

Until they are answered, keep the defaults conservative: collect the minimum, keep it private, delete nothing without asking.

## Texts and marketing

No marketing opt in exists yet. If it is added it must be an unticked, clearly worded opt in with an easy way out (CASL).
