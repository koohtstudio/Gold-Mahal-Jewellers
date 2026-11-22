import type { ExportFormat, Karat, LedgerEntry, Piece, Reservation, StoreDoc } from "@/lib/domain/schemas";
import { STORE_VERSION } from "@/lib/domain/schemas";
import { bagTotals, divHE, hstOn, priceOf, tradeInValue } from "@/lib/pricing";
import { addDays, dayKey, dayLabel, clock, isoDate, MONTHS_LONG, nextOpenDays, parseIsoDate, tzParts, windowDates, windowsFor, zonedToDate } from "@/lib/time";
import { defaultAccountant, defaultSettings } from "./defaults";

/** Sample data. Everything here is invented for the pitch. Dates are relative to now so the books always have rows. */

export const SAMPLE_RATE_24 = 20800;

function at(now: Date, daysAgo: number, hh: number, mm: number): string {
  const { y, m, d } = parseIsoDate(addDays(isoDate(now), -daysAgo));
  return zonedToDate(y, m, d, hh, mm).toISOString();
}

function piece(p: Partial<Piece> & Pick<Piece, "id" | "tag" | "slug" | "name" | "category" | "karat" | "netGramsMilli" | "makingBps" | "image">, now: Date): Piece {
  return {
    stoneCents: 0,
    units: 1,
    unitsReserved: 0,
    unitsSold: 0,
    visible: true,
    taxFree: false,
    description: "",
    optionLabel: "Option",
    options: ["Piece"],
    createdAt: at(now, 20, 10, 0),
    ...p,
  };
}

const RING_SIZES = ["5", "6", "7", "8", "9"];

export function buildPieces(now: Date): Piece[] {
  const mk = (p: Parameters<typeof piece>[0]) => piece(p, now);
  return [
    mk({ id: "p-balis", tag: "GM-1001", slug: "22k-gold-balis", name: "22k Gold Balis", category: "Earrings", karat: 22, netGramsMilli: 1600, makingBps: 1400, units: 2, unitsSold: 1, image: "/images/hoops.jpg", badge: "Popular", options: ["Pair"], description: "Light everyday hoops in 22k gold. Priced by weight at today's rate." }),
    mk({ id: "p-tops", tag: "GM-1002", slug: "large-light-weight-tops", name: "Large Light-Weight Tops", category: "Earrings", karat: 22, netGramsMilli: 2800, makingBps: 800, units: 2, image: "/images/studs.jpg", badge: "New", options: ["Pair"], description: "Beaded studs and drops, big on look and light on weight." }),
    mk({ id: "p-jhumka", tag: "GM-1003", slug: "22k-gold-jhumka", name: "22k Gold Jhumka", category: "Earrings", karat: 22, netGramsMilli: 9600, makingBps: 900, unitsReserved: 1, image: "/images/jhumka.jpg", options: ["Pair"], description: "Classic filigree jhumka with a detailed bell and beaded edge." }),
    mk({ id: "p-cuban", tag: "GM-1004", slug: "cuban-link-chain", name: "Cuban Link Chain", category: "Chains", karat: 22, netGramsMilli: 18400, makingBps: 500, image: "/images/chain-cuban.jpg", optionLabel: "Length", options: ["18 in", "20 in", "22 in", "24 in"], description: "Solid link chain in 22k gold. Heavier lengths cost more by weight." }),
    mk({ id: "p-bridal", tag: "GM-1005", slug: "bridal-necklace-set", name: "Bridal Necklace Set", category: "Bridal", karat: 22, netGramsMilli: 42000, makingBps: 700, unitsReserved: 1, image: "/images/necklace-bust.jpg", badge: "Bridal", options: ["Set"], description: "Necklace and earrings in fine gold work. Made to match." }),
    mk({ id: "p-pendantset", tag: "GM-1006", slug: "pendant-and-earring-set", name: "Pendant and Earring Set", category: "Bridal", karat: 22, netGramsMilli: 8600, makingBps: 1000, image: "/images/necklace-set-green.jpg", options: ["Set"], description: "A light pendant with matching earrings for gifting." }),
    mk({ id: "p-solitaire", tag: "GM-1007", slug: "diamond-solitaire-ring", name: "Diamond Solitaire Ring", category: "Diamonds", karat: 18, netGramsMilli: 3100, makingBps: 1200, stoneCents: 141700, unitsReserved: 1, image: "/images/ring-solitaire.jpg", badge: "Diamond", optionLabel: "Ring size", options: RING_SIZES, description: "18k setting with a diamond. Ask in store about stone details." }),
    mk({ id: "p-halo", tag: "GM-1008", slug: "moissanite-halo-ring", name: "Moissanite Halo Ring", category: "Diamonds", karat: null, netGramsMilli: 0, makingBps: 0, fixedCents: 65000, image: "/images/ring-pear.jpg", badge: "Moissanite", optionLabel: "Ring size", options: RING_SIZES, description: "Moissanite in a pear halo, set in silver. Fixed price, ask in store about certificates." }),
    mk({ id: "p-bar10", tag: "GM-1009", slug: "10-g-gold-bar", name: "10 g Gold Bar", category: "Bars", karat: 24, netGramsMilli: 10000, makingBps: 200, taxFree: true, units: 5, image: "/images/gold-bars.jpg", badge: "Bar", optionLabel: "Weight", options: ["10 g"], description: "Investment gold at the day's rate plus a small premium." }),
    mk({ id: "p-kundan", tag: "GM-1010", slug: "kundan-choker-set", name: "Kundan Choker Set", category: "Bridal", karat: 22, netGramsMilli: 26000, makingBps: 1000, image: "/images/bridal-set.jpg", options: ["Set"], description: "Choker, pendant and jhumka with coloured stones and pearl." }),
    mk({ id: "p-ruby", tag: "GM-1011", slug: "ruby-gold-bangles", name: "Ruby Gold Bangles", category: "Bridal", karat: 22, netGramsMilli: 38000, makingBps: 900, image: "/images/bangles-red.jpg", badge: "Pair", optionLabel: "Size", options: ["2.4", "2.6", "2.8"], description: "Textured 22k bangles with red stone accents and a screw clasp." }),
    mk({ id: "p-bangle-pair", tag: "GM-1012", slug: "gold-bangle-pair", name: "Gold Bangle Pair", category: "Bridal", karat: 22, netGramsMilli: 24500, makingBps: 600, unitsSold: 1, visible: false, image: "/images/bangles-red.jpg", options: ["Pair"], description: "Plain pair, sold." }),
    mk({ id: "p-kids", tag: "GM-1013", slug: "kids-gold-studs", name: "Kids Gold Studs", category: "Earrings", karat: 22, netGramsMilli: 1100, makingBps: 1200, visible: false, image: "/images/studs.jpg", options: ["Pair"], description: "Small studs for little ears." }),
    mk({ id: "p-rope", tag: "GM-1014", slug: "rope-chain-18-in", name: "Rope Chain 18 in", category: "Chains", karat: 22, netGramsMilli: 12200, makingBps: 500, visible: false, image: "/images/chain-cuban.jpg", optionLabel: "Length", options: ["18 in"], description: "Everyday rope chain." }),
    mk({ id: "p-pearl", tag: "GM-1015", slug: "18k-pearl-pendant", name: "18k Pearl Pendant", category: "Diamonds", karat: 18, netGramsMilli: 2400, makingBps: 1400, stoneCents: 26000, visible: false, image: "/images/bracelet-diamond.jpg", options: ["Piece"], description: "A small pearl pendant." }),
  ];
}

export function buildSeed(now: Date = new Date()): StoreDoc {
  const settings = defaultSettings();
  const pieces = buildPieces(now);
  const pid = (id: string) => pieces.find((p) => p.id === id) as Piece;
  const barBps = Math.round(settings.barPremiumPct * 100);

  /* Rates: seven mornings, the last one today. */
  const dollars = [201, 203, 204, 202, 205, 207, 208];
  const rates = dollars.map((v, i) => {
    const daysAgo = dollars.length - 1 - i;
    let when = at(now, daysAgo, 9, 30);
    if (daysAgo === 0 && new Date(when).getTime() > now.getTime() - 5 * 60000) when = new Date(now.getTime() - 5 * 60000).toISOString();
    return { id: `rate-${i + 1}`, publishedAt: when, rate24Cents: v * 100, publishedBy: "owner@demo.test" };
  });
  const rateNow = SAMPLE_RATE_24;

  /* Reservations. Visits land on the next open days. */
  const days = nextOpenDays(now, settings, 3);
  const dayA = days[0]?.date ?? isoDate(now);
  const dayB = days[1]?.date ?? addDays(dayA, 1);
  const open = (date: string) => settings.hours[dayKey(date)] ?? { open: 690, close: 1140 };
  const winOf = (date: string, idx: number) => {
    const h = open(date);
    const ws = windowsFor(h.open, h.close);
    const w = ws[Math.min(idx, ws.length - 1)] ?? ws[0]!;
    const { start, end } = windowDates(date, w);
    return { start: start.toISOString(), end: end.toISOString(), label: `${dayLabel(date, true)}, ${clock(w.startMin)} to ${clock(w.endMin)}` };
  };

  const mkRes = (id: string, code: string, customer: string, phone: string, p: Piece, option: string, lockedRate24Cents: number, status: Reservation["status"], createdAgoH: number, date: string, win: number, extra: Partial<Reservation> = {}): Reservation => {
    const unit = priceOf(p, lockedRate24Cents, { barPremiumBps: barBps }).totalCents;
    const tot = bagTotals([{ unitCents: unit, qty: 1, taxFree: p.taxFree }]);
    const w = winOf(date, win);
    const created = new Date(now.getTime() - createdAgoH * 3600_000).toISOString();
    const holdUntil = new Date(Math.max(new Date(created).getTime() + settings.holdHours * 3600_000, new Date(w.end).getTime())).toISOString();
    return {
      id, code, customer, phone, lines: [{ pieceId: p.id, name: p.name, option, qty: 1, unitCents: unit, taxFree: p.taxFree, image: p.image }],
      lockedRate24Cents, subtotalCents: tot.subtotalCents, hstCents: tot.hstCents, totalCents: tot.totalCents,
      visitAt: w.start, visitEndAt: w.end, visitLabel: w.label, holdUntil, status, createdAt: created, ...extra,
    };
  };

  const reservations: Reservation[] = [
    mkRes("R-1042", "GM-4821", "Simran K.", "4165550142", pid("p-jhumka"), "Pair", rateNow, "new", 3, dayB, 1),
    mkRes("R-1041", "GM-4790", "Harleen B.", "6475550177", pid("p-bridal"), "Set", rateNow, "new", 6, dayB, 2),
    mkRes("R-1040", "GM-4755", "Priya S.", "9055550118", pid("p-solitaire"), "6", rateNow, "ready", 20, dayA, 3, { readyAt: new Date(now.getTime() - 2 * 3600_000).toISOString() }),
    mkRes("R-1039", "GM-4712", "Jasleen M.", "4165550166", pid("p-balis"), "Pair", 20700, "sold", 50, addDays(isoDate(now), -1), 2, { soldAt: at(now, 1, 16, 10), readyAt: at(now, 1, 12, 0) }),
  ];

  /* Ledger. */
  let inv = 3110;
  const ledger: LedgerEntry[] = [];
  const sales: Array<[number, string, "Jewellery" | "Bullion", number]> = [
    [0, "Walk in", "Jewellery", 1954.0], [1, "Walk in", "Jewellery", 812.5], [2, "Mehak D.", "Bullion", 2183.0], [4, "Walk in", "Jewellery", 3120.0],
    [7, "Walk in", "Jewellery", 1460.0], [12, "Gurleen K.", "Jewellery", 5230.0], [16, "Walk in", "Bullion", 4366.0], [19, "Walk in", "Jewellery", 940.0],
    [23, "Walk in", "Jewellery", 2210.0], [28, "Navneet B.", "Jewellery", 6480.0], [33, "Walk in", "Bullion", 2140.0], [40, "Ritu M.", "Jewellery", 3890.0], [47, "Walk in", "Jewellery", 1275.0],
  ];
  const dateAgo = (n: number) => addDays(isoDate(now), -n);
  sales.forEach(([ago, cust, kind, dollars]) => {
    const net = Math.round(dollars * 100);
    const bull = kind === "Bullion";
    ledger.push({
      id: `led-${inv}`, date: dateAgo(ago), ref: `INV-${inv}`, source: bull ? "bullion" : "counter", customer: cust, netCents: net, hstCents: bull ? 0 : hstOn(net),
      metal: [{ karat: (bull ? 24 : 22) as Karat, gramsMilli: divHE(net * 1000, bull ? 21216 : 21060) }],
    });
    inv -= 1;
  });
  // Keep invoice numbers descending from the newest; reservation sale below.
  ledger.push({ id: "led-res-1039", date: dateAgo(1), ref: "GM-4712", source: "reservation", customer: "Jasleen M.", netCents: reservations[3]!.subtotalCents, hstCents: reservations[3]!.hstCents, metal: [{ karat: 22, gramsMilli: 1600 }] });

  /* Layaway, with payments that also reach the books. */
  const grossSplit = (gross: number) => {
    const net = divHE(gross * 100, 113);
    return { net, hst: gross - net };
  };
  let seq = 1;
  const nid = (p: string) => `${p}-${seq++}`;
  const layawayDefs: Array<{ customer: string; item: string; total: number; per: number; nextIn: number; pays: Array<[number, number]> }> = [
    { customer: "Simran P.", item: "Bridal set (sample)", total: 914251, per: 70000, nextIn: 10, pays: [[50, 150000], [30, 150000], [12, 150000]] },
    { customer: "Harpreet S.", item: "Diamond ring (sample)", total: 220843, per: 30000, nextIn: 7, pays: [[40, 80000], [15, 80000]] },
    { customer: "Jaspreet K.", item: "Gold bangles (sample)", total: 338000, per: 0, nextIn: 0, pays: [[70, 84500], [50, 84500], [30, 84500], [8, 84500]] },
  ];
  const layaway = layawayDefs.map((d, i) => {
    const payments = d.pays.map(([ago, amt]) => {
      const { net, hst } = grossSplit(amt);
      const id = nid("lp");
      ledger.push({ id: `led-${id}`, date: dateAgo(ago), ref: `LAY-${i + 1}`, source: "layaway", customer: d.customer, netCents: net, hstCents: hst });
      return { id, date: dateAgo(ago), amountCents: amt };
    });
    const paid = payments.reduce((a, p) => a + p.amountCents, 0);
    return { id: `lay-${i + 1}`, customer: d.customer, itemLabel: d.item, totalCents: d.total, paidCents: paid, instalmentCents: d.per, nextDue: d.nextIn ? addDays(isoDate(now), d.nextIn) : "", payments };
  });

  /* Jobs. */
  const jobDefs: Array<[string, string, "custom" | "repair" | "resize", string, number, number, number, "intake" | "workshop" | "ready", number]> = [
    ["J-214", "Navjot K.", "custom", "Custom bridal haar", 840000, 200000, 45, "intake", 9],
    ["J-213", "Ravneet S.", "resize", "Ring resize to 7", 4500, 2000, 3, "intake", 3],
    ["J-211", "Harpreet S.", "repair", "Chain repair", 3000, 1000, 2, "workshop", 6],
    ["J-209", "Anita R.", "custom", "Custom pendant", 125000, 30000, 11, "workshop", 12],
    ["J-205", "Manpreet G.", "repair", "Stone reset", 8000, 2000, 0, "ready", 8],
  ];
  const jobs = jobDefs.map(([ticket, customer, type, title, quote, dep, dueIn, stage, ago]) => {
    if (dep > 0) {
      const { net, hst } = grossSplit(dep);
      ledger.push({ id: `led-${ticket}`, date: dateAgo(Math.min(ago, 30)), ref: ticket, source: "job", customer, netCents: net, hstCents: hst });
    }
    return { id: ticket, ticket, customer, type, title, quoteCents: quote, depositCents: dep, dueDate: addDays(isoDate(now), dueIn), stage, createdAt: at(now, ago, 13, 0) };
  });

  /* Old gold. */
  const ogDefs: Array<[number, string, Karat, number, boolean]> = [
    [2, "Walk in", 22, 14200, true], [5, "Gurleen K.", 18, 6500, true], [10, "Walk in", 22, 31000, true], [17, "Ritu M.", 24, 5000, false], [25, "Walk in", 22, 18000, false],
  ];
  const oldGold = ogDefs.map(([ago, customer, karat, g, melt], i) => {
    const t = tradeInValue(g, karat, 20700, Math.round(settings.buyRatePct * 100));
    return { id: `og-${i + 1}`, date: dateAgo(ago), customer, karat, gramsMilli: g, pureGramsMilli: t.pureGramsMilli, buyRateCents: t.buyRateCents, paidCents: t.valueCents, idChecked: true, idRef: `Sample ID ref ${1000 + i}`, awaitingMelt: melt, ...(melt ? {} : { meltedAt: at(now, Math.max(0, ago - 3), 11, 0) }) };
  });

  /* Expenses. */
  const expDefs: Array<[number, string, "Gold purchase" | "Diamonds and stones" | "Rent" | "Insurance" | "Packaging" | "Advertising", number, Karat?, number?]> = [
    [3, "Royal Bullion Wholesale", "Gold purchase", 9800, 22, 51400], [11, "Mayfield Plaza", "Rent", 3600], [14, "Diamond Source Canada", "Diamonds and stones", 2100],
    [19, "Aviva Insurance", "Insurance", 640], [6, "Gift Box Supply", "Packaging", 180], [28, "Royal Bullion Wholesale", "Gold purchase", 7400, 22, 39000],
    [42, "Mayfield Plaza", "Rent", 3600], [48, "Meta Ads", "Advertising", 320],
  ];
  const expenses = expDefs.map(([ago, vendor, category, dollars, karat, gm], i) => {
    const net = dollars * 100;
    return { id: `exp-${i + 1}`, date: dateAgo(ago), vendor, category, netCents: net, hstCents: category === "Insurance" ? 0 : hstOn(net), ...(karat && gm ? { metalKarat: karat, metalGramsMilli: gm } : {}) };
  });

  /* Requests from the website. */
  const visitDay = days[2]?.date ?? dayB;
  const val = tradeInValue(18000, 22, rateNow, Math.round(settings.buyRatePct * 100));
  const first = (y: number, m: number) => zonedToDate(y, m, 1, 9, 0).toISOString();
  const t = tzParts(now);
  const prev = t.m === 1 ? { y: t.y - 1, m: 12 } : { y: t.y, m: t.m - 1 };
  const prev2 = prev.m === 1 ? { y: prev.y - 1, m: 12 } : { y: prev.y, m: prev.m - 1 };
  const acct = defaultAccountant();
  const sendLog = [
    { id: "send-2", period: "last-month", periodLabel: `${MONTHS_LONG[prev.m - 1]} ${prev.y}`, format: "standard" as ExportFormat, to: acct.email, sentAt: first(t.y, t.m), status: "sent" as const },
    { id: "send-1", period: "older", periodLabel: `${MONTHS_LONG[prev2.m - 1]} ${prev2.y}`, format: "standard" as ExportFormat, to: acct.email, sentAt: first(prev.y, prev.m), status: "sent" as const },
  ];

  const doc: StoreDoc = {
    version: STORE_VERSION,
    createdAt: now.toISOString(),
    rates,
    pieces,
    reservations,
    jobs,
    oldGold,
    layaway,
    ledger: ledger.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    expenses,
    accountant: acct,
    sendLog,
    settings,
    visits: [{ id: "vr-1", createdAt: at(now, 0, 8, 40) > now.toISOString() ? now.toISOString() : at(now, 0, 8, 40), type: "Repairs and resizing", preferredDate: visitDay, name: "Anita R.", phone: "4165550123", status: "new" }],
    valuations: [{ id: "val-1", createdAt: new Date(now.getTime() - 3 * 3600_000).toISOString(), karat: 22, gramsMilli: 18000, estimateCents: val.valueCents, name: "Hardeep S.", phone: "9055550190", preferredDate: visitDay, status: "new" }],
    audit: [
      { id: "aud-1", at: rates[6]!.publishedAt, actor: "owner@demo.test", action: "rate.publish", target: `$${(rateNow / 100).toFixed(2)} per gram (24k)` },
      { id: "aud-2", at: at(now, 1, 16, 10), actor: "owner@demo.test", action: "reservation.sold", target: "GM-4712" },
    ],
    sent: [
      { id: "msg-1", at: at(now, 1, 12, 0), channel: "sms", to: "(416) 555-0166", kind: "ready", body: "Your Gold Mahal reservation is ready. Show code GM-4712 at the counter." },
      { id: "msg-2", at: first(t.y, t.m), channel: "email", to: acct.email, kind: "accountant", subject: `${MONTHS_LONG[prev.m - 1]} books`, body: "Sales, purchases, old gold, metal ledger and HST summary attached (sample, nothing was sent)." },
    ],
    counters: { piece: 1015, job: 214, reservation: 1042, invoice: 3110, layaway: 3, seq },
  };
  // Seeds are always internally consistent: units reserved match open holds.
  for (const p of doc.pieces) {
    const held = doc.reservations.filter((r) => r.status === "new" || r.status === "ready").reduce((a, r) => a + r.lines.filter((l) => l.pieceId === p.id).reduce((s, l) => s + l.qty, 0), 0);
    if (held !== p.unitsReserved) p.unitsReserved = held;
  }
  return doc;
}
