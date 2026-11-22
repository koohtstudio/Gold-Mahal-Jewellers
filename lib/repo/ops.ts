import { DomainError } from "@/lib/domain/errors";
import type {
  Expense, ExportFormat, Job, LayawayPlan, LedgerEntry, NewExpenseInput, NewJobInput, NewLayawayInput, NewOldGoldInput, NewPieceInput, OldGoldPurchase, Piece, Rate,
  Reservation, ReserveInput, SendLog, Session, Settings, StoreDoc, ValuationInput, ValuationRequest, VisitInput, VisitRequest,
} from "@/lib/domain/schemas";
import { formatPhone, normalizePhone } from "@/lib/guards";
import { availableUnits, bagTotals, buyRatePerGram, divHE, hstOn, moneyWhole, pureGramsMilli, priceOf, tradeInValue } from "@/lib/pricing";
import { addDays, clock, dayKey, dayLabel, isoDate, type Period, tzParts } from "@/lib/time";

/**
 * Pure domain operations on a StoreDoc. Each receives a doc that is already a private clone, mutates it and returns a result.
 * The mock store, the demo store and the contract tests all run the same code.
 */

export interface Ctx {
  now: Date;
  session: Session | null;
  random: () => number;
}

export const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

export function requireStaff(ctx: Ctx): Session {
  if (!ctx.session) throw new DomainError("forbidden", "Please sign in to the admin.");
  return ctx.session;
}
export function requireOwner(ctx: Ctx): Session {
  const s = requireStaff(ctx);
  if (s.role !== "owner") throw new DomainError("forbidden", "Only the owner can do this.");
  return s;
}

function nid(doc: StoreDoc, prefix: string): string {
  return `${prefix}-${doc.counters.seq++}`;
}

export function audit(doc: StoreDoc, ctx: Ctx, action: string, target: string, meta?: string) {
  doc.audit.unshift({ id: nid(doc, "aud"), at: ctx.now.toISOString(), actor: ctx.session?.email ?? "customer", action, target, ...(meta ? { meta } : {}) });
  if (doc.audit.length > 500) doc.audit.length = 500;
}

export function sendText(doc: StoreDoc, ctx: Ctx, to: string, body: string, kind: string) {
  doc.sent.unshift({ id: nid(doc, "msg"), at: ctx.now.toISOString(), channel: "sms", to: formatPhone(to), kind, body });
  if (doc.sent.length > 300) doc.sent.length = 300;
}

export function currentRate(doc: StoreDoc): Rate {
  let best = doc.rates[0];
  for (const r of doc.rates) if (!best || r.publishedAt >= best.publishedAt) best = r;
  if (!best) throw new DomainError("not_found", "No gold rate has been published yet.");
  return best;
}

const barBps = (s: Settings) => Math.round(s.barPremiumPct * 100);
export const priceNow = (doc: StoreDoc, p: Piece, rate24 = currentRate(doc).rate24Cents) => priceOf(p, rate24, { barPremiumBps: barBps(doc.settings) });
const today = (ctx: Ctx) => isoDate(ctx.now);
const grossSplit = (gross: number) => {
  const net = divHE(gross * 100, 113);
  return { netCents: net, hstCents: gross - net };
};

/* Rates */

export function publishRate(doc: StoreDoc, ctx: Ctx, rate24Cents: number): Rate {
  const s = requireOwner(ctx);
  if (!Number.isInteger(rate24Cents) || rate24Cents < 5000 || rate24Cents > 100000) throw new DomainError("validation", "That rate looks wrong. Enter a 24k price per gram between $50 and $1,000.");
  const rate: Rate = { id: nid(doc, "rate"), publishedAt: ctx.now.toISOString(), rate24Cents, publishedBy: s.email };
  doc.rates.push(rate);
  if (doc.rates.length > 120) doc.rates.splice(0, doc.rates.length - 120);
  audit(doc, ctx, "rate.publish", `${moneyWhole(rate24Cents)} per gram (24k)`);
  return rate;
}

/* Pieces */

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "piece";
}

export function addPiece(doc: StoreDoc, ctx: Ctx, input: NewPieceInput): Piece {
  requireStaff(ctx);
  if (input.karat === null && input.fixedCents === undefined) throw new DomainError("validation", "A piece with no karat needs a fixed price.");
  if (input.karat !== null && input.netGramsMilli <= 0) throw new DomainError("validation", "Enter the net weight in grams.");
  let slug = slugify(input.name);
  const base = slug;
  for (let i = 2; doc.pieces.some((p) => p.slug === slug); i++) slug = `${base}-${i}`;
  const tag = `GM-${++doc.counters.piece}`;
  const cat = input.category;
  const optionLabel = cat === "Chains" ? "Length" : cat === "Bars" ? "Weight" : cat === "Diamonds" ? "Ring size" : "Option";
  const options = cat === "Chains" ? ["18 in", "20 in", "22 in", "24 in"] : cat === "Bars" ? [`${(input.netGramsMilli / 1000).toFixed(0)} g`] : cat === "Diamonds" ? ["5", "6", "7", "8", "9"] : ["Piece"];
  const piece: Piece = {
    id: nid(doc, "p"), tag, slug, name: input.name, category: cat, karat: cat === "Bars" ? 24 : input.karat, netGramsMilli: input.netGramsMilli, makingBps: input.makingBps,
    stoneCents: input.stoneCents, ...(input.fixedCents !== undefined ? { fixedCents: input.fixedCents } : {}), units: input.units, unitsReserved: 0, unitsSold: 0,
    visible: input.visible ?? true, ...(input.certificateRef ? { certificateRef: input.certificateRef } : {}), taxFree: cat === "Bars", image: input.image,
    description: input.description ?? "", optionLabel, options, createdAt: ctx.now.toISOString(),
  };
  doc.pieces.push(piece);
  audit(doc, ctx, "piece.add", `${tag} ${piece.name}`);
  return piece;
}

export function updatePiece(doc: StoreDoc, ctx: Ctx, id: string, patch: Partial<Pick<Piece, "visible" | "image" | "name" | "description" | "certificateRef" | "units">>): Piece {
  requireStaff(ctx);
  const p = doc.pieces.find((x) => x.id === id);
  if (!p) throw new DomainError("not_found", "That piece is not in the inventory.");
  if (patch.units !== undefined && patch.units < p.unitsReserved + p.unitsSold) throw new DomainError("validation", "Units cannot be lower than what is already reserved or sold.");
  Object.assign(p, patch);
  audit(doc, ctx, "piece.update", p.tag);
  return p;
}

function ledgerFor(doc: StoreDoc, ctx: Ctx, ref: string, source: LedgerEntry["source"], customer: string, lines: Array<{ piece: Piece | undefined; unitCents: number; qty: number; taxFree: boolean }>): LedgerEntry {
  const netCents = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);
  const taxable = lines.filter((l) => !l.taxFree).reduce((a, l) => a + l.unitCents * l.qty, 0);
  const metal = lines.flatMap((l) => (l.piece && l.piece.karat ? [{ karat: l.piece.karat, gramsMilli: l.piece.netGramsMilli * l.qty }] : []));
  const e: LedgerEntry = { id: nid(doc, "led"), date: today(ctx), ref, source, customer, netCents, hstCents: hstOn(taxable), ...(metal.length ? { metal } : {}) };
  doc.ledger.unshift(e);
  return e;
}

export function sellAtCounter(doc: StoreDoc, ctx: Ctx, id: string, input: { customer: string; qty?: number }): LedgerEntry[] {
  requireStaff(ctx);
  const p = doc.pieces.find((x) => x.id === id);
  if (!p) throw new DomainError("not_found", "That piece is not in the inventory.");
  const qty = input.qty ?? 1;
  if (availableUnits(p) < qty) throw new DomainError("sold_out", `${p.name} is not available. It is reserved or sold.`);
  p.unitsSold += qty;
  const unitCents = priceNow(doc, p).totalCents;
  const inv = `INV-${++doc.counters.invoice}`;
  const e = ledgerFor(doc, ctx, inv, p.taxFree ? "bullion" : "counter", input.customer.trim() || "Walk in", [{ piece: p, unitCents, qty, taxFree: p.taxFree }]);
  audit(doc, ctx, "piece.sold", `${p.tag} at counter`, inv);
  return [e];
}

/* Reservations */

export function slotLoad(doc: StoreDoc, date: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of doc.reservations) {
    if ((r.status === "new" || r.status === "ready") && isoDate(new Date(r.visitAt)) === date) out[r.visitAt] = (out[r.visitAt] ?? 0) + 1;
  }
  return out;
}

export function createReservation(doc: StoreDoc, ctx: Ctx, input: ReserveInput): Reservation {
  const settings = doc.settings;
  if (!settings.acceptOrders) throw new DomainError("closed", "Online reserving is paused. Please call the store.");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("validation", "Please enter a 10 digit mobile number.");
  const start = new Date(input.visitStartAt);
  const end = new Date(input.visitEndAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new DomainError("validation", "Please choose a visit time.");
  if (end.getTime() <= ctx.now.getTime()) throw new DomainError("validation", "That time has already passed. Please choose another.");
  const date = isoDate(start);
  if (!settings.hours[dayKey(date)]) throw new DomainError("closed", "We are closed that day. Please choose another.");
  if ((slotLoad(doc, date)[start.toISOString()] ?? 0) >= settings.slotCapacity) throw new DomainError("conflict", "That time is full. Please choose another window.");

  const want = new Map<string, number>();
  for (const l of input.lines) want.set(l.pieceId, (want.get(l.pieceId) ?? 0) + l.qty);
  for (const [pid, qty] of want) {
    const p = doc.pieces.find((x) => x.id === pid);
    if (!p || !p.visible) throw new DomainError("not_found", "One of those pieces is no longer listed.");
    if (availableUnits(p) < qty) throw new DomainError("sold_out", `${p.name} was just reserved or sold. Please remove it from your bag.`);
  }
  const rate = currentRate(doc);
  const lines = input.lines.map((l) => {
    const p = doc.pieces.find((x) => x.id === l.pieceId) as Piece;
    if (p.options.length > 0 && !p.options.includes(l.option)) throw new DomainError("validation", `Please choose a ${p.optionLabel.toLowerCase()} for ${p.name}.`);
    return { pieceId: p.id, name: p.name, option: l.option, qty: l.qty, unitCents: priceNow(doc, p, rate.rate24Cents).totalCents, taxFree: p.taxFree, image: p.image };
  });
  const totals = bagTotals(lines);

  let code = "";
  for (let i = 0; i < 300; i++) {
    const c = `GM-${2000 + Math.floor(ctx.random() * 8000)}`;
    if (!doc.reservations.some((r) => r.code === c)) {
      code = c;
      break;
    }
  }
  if (!code) throw new DomainError("conflict", "Please try again in a moment.");

  const holdUntil = new Date(Math.max(ctx.now.getTime() + settings.holdHours * 3600_000, end.getTime()));
  const label = `${dayLabel(date, true)}, ${clock(tzParts(start).h * 60 + tzParts(start).min)} to ${clock(tzParts(end).h * 60 + tzParts(end).min)}`;
  const res: Reservation = {
    id: `R-${++doc.counters.reservation}`, code, customer: input.name.trim(), phone, lines, lockedRate24Cents: rate.rate24Cents,
    subtotalCents: totals.subtotalCents, hstCents: totals.hstCents, totalCents: totals.totalCents, visitAt: start.toISOString(), visitEndAt: end.toISOString(), visitLabel: label,
    holdUntil: holdUntil.toISOString(), status: "new", createdAt: ctx.now.toISOString(),
  };
  doc.reservations.unshift(res);
  for (const [pid, qty] of want) (doc.pieces.find((x) => x.id === pid) as Piece).unitsReserved += qty;
  sendText(doc, ctx, phone, `Hi ${firstName(res.customer)}, your Gold Mahal reservation ${code} is booked for ${label}. Pay at the store. We will hold your pieces until ${dayLabel(isoDate(holdUntil), false)}.`, "reservation");
  if (settings.textOnNew) sendText(doc, ctx, "9059131212", `New reservation ${code} from ${firstName(res.customer)}: ${lines.map((l) => l.name).join(", ")}.`, "store-alert");
  return res;
}

/** When the rate is not locked, open reservations follow the current rate until they are sold. */
export function viewReservation(doc: StoreDoc, r: Reservation): Reservation {
  if (doc.settings.lockRate || (r.status !== "new" && r.status !== "ready")) return r;
  return repriced(doc, r);
}

function repriced(doc: StoreDoc, r: Reservation): Reservation {
  const rate = currentRate(doc).rate24Cents;
  const lines = r.lines.map((l) => {
    const p = doc.pieces.find((x) => x.id === l.pieceId);
    return p ? { ...l, unitCents: priceNow(doc, p, rate).totalCents } : l;
  });
  const t = bagTotals(lines);
  return { ...r, lines, lockedRate24Cents: rate, subtotalCents: t.subtotalCents, hstCents: t.hstCents, totalCents: t.totalCents };
}

function findRes(doc: StoreDoc, id: string): Reservation {
  const r = doc.reservations.find((x) => x.id === id);
  if (!r) throw new DomainError("not_found", "That reservation was not found.");
  return r;
}

function freeUnits(doc: StoreDoc, r: Reservation, sold: boolean) {
  for (const l of r.lines) {
    const p = doc.pieces.find((x) => x.id === l.pieceId);
    if (!p) continue;
    p.unitsReserved = Math.max(0, p.unitsReserved - l.qty);
    if (sold) p.unitsSold += l.qty;
  }
}

export function markReady(doc: StoreDoc, ctx: Ctx, id: string): Reservation {
  requireStaff(ctx);
  const r = findRes(doc, id);
  if (r.status !== "new") throw new DomainError("bad_state", "Only a new reservation can be marked ready.");
  r.status = "ready";
  r.readyAt = ctx.now.toISOString();
  sendText(doc, ctx, r.phone, doc.settings.readyText.replace("{code}", r.code).replace("{item}", r.lines[0]?.name ?? "your pieces"), "ready");
  audit(doc, ctx, "reservation.ready", r.code);
  return r;
}

export function markSold(doc: StoreDoc, ctx: Ctx, id: string): Reservation {
  requireStaff(ctx);
  const r = findRes(doc, id);
  if (r.status !== "new" && r.status !== "ready") throw new DomainError("bad_state", "Only an open reservation can be marked sold.");
  if (!doc.settings.lockRate) Object.assign(r, repriced(doc, r));
  freeUnits(doc, r, true);
  r.status = "sold";
  r.soldAt = ctx.now.toISOString();
  const withPieces = r.lines.map((l) => ({ piece: doc.pieces.find((p) => p.id === l.pieceId), unitCents: l.unitCents, qty: l.qty, taxFree: l.taxFree }));
  const taxable = withPieces.filter((l) => !l.taxFree);
  const bullion = withPieces.filter((l) => l.taxFree);
  if (taxable.length) ledgerFor(doc, ctx, r.code, "reservation", r.customer, taxable);
  if (bullion.length) ledgerFor(doc, ctx, r.code, "bullion", r.customer, bullion);
  audit(doc, ctx, "reservation.sold", r.code, moneyWhole(r.totalCents));
  return r;
}

export function releaseReservation(doc: StoreDoc, ctx: Ctx, id: string): Reservation {
  requireStaff(ctx);
  const r = findRes(doc, id);
  if (r.status !== "new" && r.status !== "ready") throw new DomainError("bad_state", "Only an open reservation can be released.");
  freeUnits(doc, r, false);
  r.status = "released";
  r.releasedAt = ctx.now.toISOString();
  audit(doc, ctx, "reservation.release", r.code);
  return r;
}

export function maintenanceDue(doc: StoreDoc, now: Date): boolean {
  const t = now.getTime();
  return doc.reservations.some((r) => (r.status === "new" || r.status === "ready") && (new Date(r.holdUntil).getTime() <= t || (!r.noticeAt && new Date(r.holdUntil).getTime() - t <= 24 * 3600_000)));
}

/** Expires overdue holds and sends the heads up text a day before. Runs in the browser in mock mode and as a cron job in live mode. */
export function expireDue(doc: StoreDoc, ctx: Ctx): number {
  let n = 0;
  const t = ctx.now.getTime();
  for (const r of doc.reservations) {
    if (r.status !== "new" && r.status !== "ready") continue;
    const hold = new Date(r.holdUntil).getTime();
    if (hold <= t) {
      freeUnits(doc, r, false);
      r.status = "expired";
      r.releasedAt = ctx.now.toISOString();
      audit(doc, ctx, "reservation.expire", r.code);
      n++;
    } else if (!r.noticeAt && hold - t <= 24 * 3600_000) {
      r.noticeAt = ctx.now.toISOString();
      sendText(doc, ctx, r.phone, doc.settings.expiryText.replace("{item}", r.lines[0]?.name ?? "your pieces"), "expiry-notice");
    }
  }
  return n;
}

/* Jobs */

export function addJob(doc: StoreDoc, ctx: Ctx, input: NewJobInput): Job {
  requireStaff(ctx);
  if (input.depositCents > input.quoteCents) throw new DomainError("validation", "The deposit cannot be more than the quote.");
  const ticket = `J-${++doc.counters.job}`;
  const job: Job = { id: ticket, ticket, customer: input.customer.trim(), ...(input.phone ? { phone: input.phone } : {}), type: input.type, title: input.title.trim(), quoteCents: input.quoteCents, depositCents: input.depositCents, dueDate: input.dueDate, stage: "intake", createdAt: ctx.now.toISOString() };
  doc.jobs.unshift(job);
  if (input.depositCents > 0) doc.ledger.unshift({ id: nid(doc, "led"), date: today(ctx), ref: ticket, source: "job", customer: job.customer, ...grossSplit(input.depositCents) });
  audit(doc, ctx, "job.add", ticket);
  return job;
}

export function advanceJob(doc: StoreDoc, ctx: Ctx, id: string): Job {
  requireStaff(ctx);
  const j = doc.jobs.find((x) => x.id === id);
  if (!j) throw new DomainError("not_found", "That job was not found.");
  if (j.stage === "intake") j.stage = "workshop";
  else if (j.stage === "workshop") {
    j.stage = "ready";
    j.textedAt = ctx.now.toISOString();
    if (j.phone && normalizePhone(j.phone)) sendText(doc, ctx, j.phone, `Hi ${firstName(j.customer)}, your ${j.title.toLowerCase()} (${j.ticket}) is ready for pickup at Gold Mahal.`, "job-ready");
  } else throw new DomainError("bad_state", "That job is already ready for pickup.");
  return j;
}

export function collectBalance(doc: StoreDoc, ctx: Ctx, id: string): Job {
  requireStaff(ctx);
  const j = doc.jobs.find((x) => x.id === id);
  if (!j) throw new DomainError("not_found", "That job was not found.");
  if (j.stage !== "ready" || j.closedAt) throw new DomainError("bad_state", "Only a ready job can be handed over.");
  const balance = j.quoteCents - j.depositCents;
  if (balance > 0) doc.ledger.unshift({ id: nid(doc, "led"), date: today(ctx), ref: j.ticket, source: "job", customer: j.customer, ...grossSplit(balance) });
  j.closedAt = ctx.now.toISOString();
  audit(doc, ctx, "job.handover", j.ticket, moneyWhole(balance));
  return j;
}

/* Old gold */

export function addOldGold(doc: StoreDoc, ctx: Ctx, input: NewOldGoldInput): OldGoldPurchase {
  requireStaff(ctx);
  if (!input.idChecked) throw new DomainError("id_required", "Photo ID must be checked before any payout.");
  if (!input.idRef.trim()) throw new DomainError("validation", "Add the ID reference (for example the last digits and type).");
  const rate = currentRate(doc).rate24Cents;
  const t = tradeInValue(input.gramsMilli, input.karat, rate, Math.round(doc.settings.buyRatePct * 100));
  const og: OldGoldPurchase = {
    id: nid(doc, "og"), date: today(ctx), customer: input.customer.trim() || "Walk in", karat: input.karat, gramsMilli: input.gramsMilli, pureGramsMilli: t.pureGramsMilli,
    buyRateCents: t.buyRateCents, paidCents: t.valueCents, idChecked: true, idRef: input.idRef.trim(), awaitingMelt: true,
  };
  doc.oldGold.unshift(og);
  audit(doc, ctx, "oldgold.buy", `${og.karat}k ${(og.gramsMilli / 1000).toFixed(1)} g`, moneyWhole(og.paidCents));
  return og;
}

export function markMelted(doc: StoreDoc, ctx: Ctx, id: string): OldGoldPurchase {
  requireStaff(ctx);
  const o = doc.oldGold.find((x) => x.id === id);
  if (!o) throw new DomainError("not_found", "That purchase was not found.");
  o.awaitingMelt = false;
  o.meltedAt = ctx.now.toISOString();
  return o;
}

export function revealOldGoldId(doc: StoreDoc, ctx: Ctx, id: string): string {
  requireOwner(ctx);
  const o = doc.oldGold.find((x) => x.id === id);
  if (!o) throw new DomainError("not_found", "That purchase was not found.");
  audit(doc, ctx, "oldgold.id.view", `${o.date} ${o.customer}`);
  return o.idRef;
}

export const maskOldGold = (o: OldGoldPurchase): OldGoldPurchase => ({ ...o, idRef: "On file" });

/* Layaway */

export function addLayaway(doc: StoreDoc, ctx: Ctx, input: NewLayawayInput): LayawayPlan {
  requireStaff(ctx);
  if (input.depositCents > input.totalCents) throw new DomainError("validation", "The deposit cannot be more than the total.");
  const id = `lay-${++doc.counters.layaway}`;
  const payments: LayawayPlan["payments"] = [];
  if (input.depositCents > 0) {
    const pid = nid(doc, "lp");
    payments.push({ id: pid, date: today(ctx), amountCents: input.depositCents });
    doc.ledger.unshift({ id: nid(doc, "led"), date: today(ctx), ref: id.toUpperCase(), source: "layaway", customer: input.customer.trim(), ...grossSplit(input.depositCents) });
  }
  const plan: LayawayPlan = { id, customer: input.customer.trim(), itemLabel: input.itemLabel.trim(), totalCents: input.totalCents, paidCents: input.depositCents, instalmentCents: input.instalmentCents, nextDue: input.depositCents >= input.totalCents ? "" : input.nextDue, payments };
  doc.layaway.unshift(plan);
  audit(doc, ctx, "layaway.add", id);
  return plan;
}

export function recordLayawayPayment(doc: StoreDoc, ctx: Ctx, id: string, amountCents?: number): LayawayPlan {
  requireStaff(ctx);
  const l = doc.layaway.find((x) => x.id === id);
  if (!l) throw new DomainError("not_found", "That plan was not found.");
  const balance = l.totalCents - l.paidCents;
  if (balance <= 0) throw new DomainError("bad_state", "This plan is paid in full.");
  const amt = Math.min(balance, amountCents ?? l.instalmentCents);
  if (amt <= 0) throw new DomainError("validation", "Enter a payment amount.");
  const pid = nid(doc, "lp");
  l.payments.push({ id: pid, date: today(ctx), amountCents: amt });
  l.paidCents += amt;
  l.nextDue = l.paidCents >= l.totalCents ? "" : addDays(l.nextDue && l.nextDue > today(ctx) ? l.nextDue : today(ctx), 28);
  doc.ledger.unshift({ id: nid(doc, "led"), date: today(ctx), ref: l.id.toUpperCase(), source: "layaway", customer: l.customer, ...grossSplit(amt) });
  audit(doc, ctx, "layaway.payment", l.id, moneyWhole(amt));
  return l;
}

/* Books */

export function addExpense(doc: StoreDoc, ctx: Ctx, input: NewExpenseInput): Expense {
  requireOwner(ctx);
  const e: Expense = {
    id: nid(doc, "exp"), date: input.date ?? today(ctx), vendor: input.vendor.trim(), category: input.category, netCents: input.netCents,
    hstCents: input.hstCents ?? (input.category === "Insurance" ? 0 : hstOn(input.netCents)),
    ...(input.invoiceUrl ? { invoiceUrl: input.invoiceUrl } : {}), ...(input.metalKarat && input.metalGramsMilli ? { metalKarat: input.metalKarat, metalGramsMilli: input.metalGramsMilli } : {}),
  };
  doc.expenses.unshift(e);
  audit(doc, ctx, "expense.add", `${e.vendor} ${moneyWhole(e.netCents)}`);
  return e;
}

export function logExport(doc: StoreDoc, ctx: Ctx, kind: string, period: Period) {
  requireOwner(ctx);
  audit(doc, ctx, "books.export", `${kind} (${period.label})`);
}

export function sendToAccountant(doc: StoreDoc, ctx: Ctx, period: Period, format: ExportFormat): SendLog {
  requireOwner(ctx);
  const a = doc.accountant;
  if (!/^\S+@\S+\.\S+$/.test(a.email)) throw new DomainError("validation", "Add your accountant's email first.");
  const log: SendLog = { id: nid(doc, "send"), period: period.key, periodLabel: period.label, format, to: a.email, sentAt: ctx.now.toISOString(), status: "sent" };
  doc.sendLog.unshift(log);
  doc.sent.unshift({ id: nid(doc, "msg"), at: ctx.now.toISOString(), channel: "email", to: a.email, kind: "accountant", subject: `${period.label} books`, body: `Sales, purchases, old gold, metal ledger and HST summary for ${period.label} (${format}). Sample, nothing was sent.` });
  audit(doc, ctx, "accountant.send", `${period.label} to ${a.email}`, format);
  return log;
}

export function updateSettings(doc: StoreDoc, ctx: Ctx, patch: Partial<Settings>): Settings {
  requireOwner(ctx);
  doc.settings = { ...doc.settings, ...patch };
  audit(doc, ctx, "settings.update", Object.keys(patch).join(", "));
  return doc.settings;
}

/* Visits and valuations */

export function addVisit(doc: StoreDoc, ctx: Ctx, input: VisitInput): VisitRequest {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("validation", "Please enter a 10 digit mobile number.");
  const v: VisitRequest = { id: nid(doc, "vr"), createdAt: ctx.now.toISOString(), type: input.type, preferredDate: input.preferredDate, name: input.name.trim(), phone, status: "new" };
  doc.visits.unshift(v);
  if (doc.settings.textOnNew) sendText(doc, ctx, "9059131212", `New ${input.type.toLowerCase()} visit request from ${firstName(v.name)} for ${dayLabel(input.preferredDate)}.`, "store-alert");
  return v;
}

export function addValuation(doc: StoreDoc, ctx: Ctx, input: ValuationInput): ValuationRequest {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("validation", "Please enter a 10 digit mobile number.");
  const est = tradeInValue(input.gramsMilli, input.karat, currentRate(doc).rate24Cents, Math.round(doc.settings.buyRatePct * 100));
  const v: ValuationRequest = { id: nid(doc, "val"), createdAt: ctx.now.toISOString(), karat: input.karat, gramsMilli: input.gramsMilli, estimateCents: est.valueCents, name: input.name.trim(), phone, preferredDate: input.preferredDate, status: "new" };
  doc.valuations.unshift(v);
  if (doc.settings.textOnNew) sendText(doc, ctx, "9059131212", `New valuation request from ${firstName(v.name)}: ${input.karat}k, ${(input.gramsMilli / 1000).toFixed(1)} g.`, "store-alert");
  return v;
}

export function setRequestStatus(doc: StoreDoc, ctx: Ctx, kind: "visit" | "valuation", id: string, status: "new" | "called" | "done") {
  requireStaff(ctx);
  const list = kind === "visit" ? doc.visits : doc.valuations;
  const row = list.find((x) => x.id === id);
  if (!row) throw new DomainError("not_found", "That request was not found.");
  row.status = status;
}

export { pureGramsMilli, buyRatePerGram };
