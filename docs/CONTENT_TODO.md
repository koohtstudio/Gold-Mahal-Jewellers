# Content to-do: what the owner has to confirm

Add `?review=1` to any page to see `[confirm]` markers next to every fact that is still a guess. Nothing on the site makes a purity, hallmark, certificate or buyback claim until the owner approves it. Each claim is a flag in `lib/content/claims.ts`. All flags start off.

## Claims, off until approved

| Flag | Wording that stays off | What shows instead |
|---|---|---|
| `certifiedStones` | "Certified stones", "GRA certified moissanite and diamonds", "certificate shown in store" | "Diamonds and moissanite. Ask in store about stone details and certificates." |
| `hallmark` | Any hallmark or tested purity statement | Nothing |
| `testedInStore` | "We weigh and test everything in front of you" | "Your piece is weighed in front of you and the final number is confirmed in store." |
| `buyback` | Any promise to buy back what the store sold | Nothing |
| `ultrasonicClean` | "Ultrasonic clean and polish" | "Cleaning and polish" |
| `barsHstExempt` | Gold bars are HST exempt | Shown as a sample with a confirm marker |
| `cardAtStore` | Paying by card at the store | Not mentioned |

## Facts to confirm

1. Which phone and address are right. Google Maps says (905) 913-1212 and Unit 27. One Instagram caption says 647-291-2461 and 6201 Mayfield Rd, Unit 56. The site uses the Google pair.
2. Real catalogue: tags, karats, net weights, making charges, stones, certificates. Every piece, weight and price on the site is sample data.
3. Who sets the daily rate, and when. Old gold buy rate (sample is 94% of the 24k rate). Bar premium (sample is 2%).
4. Hold time (sample 48 hours), deposit policy, layaway terms, repair and custom pricing.
5. Visit day rule. A hold lasts 48 hours or until the end of the visit day, whichever is later. The alternative is to only offer visit days inside the hold.
6. Delivery or shipping: offered or not.
7. HST treatment of bullion, trade-ins, layaway payments and insurance. These are sample defaults in the books.
8. Accountant name, email, HST number, fiscal year end, preferred format. The accountant in the admin is a placeholder (`accountant@example.com`).
9. Holiday hours.
10. Who receives reservation texts and visit requests.
11. Which Google reviews to show, if any. The 5.0 rating and 17 reviews come from Google Maps and need confirming. Nothing is quoted.
12. Dealer recordkeeping and ID questions in `docs/SECURITY.md`.

## Photos

- `public/images/poster.jpg` (grand opening poster) and `public/images/logo.jpg` come from the store's Instagram, @goldmahal_jewellers. **Get the owner's permission before launch.** The poster is used in Our story. The logo file is copied in but not shown.
- The 15 other photos are stock photos from Unsplash (free licence, links in `CONTENT.md` section 7). They are placeholders so the site reads like a real jewellery site. **Replace each with the store's own product photography before launch.** The admin lets the owner swap a photo per piece.
- `bracelet-diamond.jpg` is spare and only used on a hidden piece.
- Instagram reel frames with price text on them are never used as product images.

## Other

- The "Map goes here" box is a styled block with a link to directions. Add a real map when the owner says which provider.
- No newsletter or marketing opt in exists. If wanted, it must be an unticked, clearly worded opt in (CASL).
