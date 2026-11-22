import type { Karat, Piece } from "@/lib/domain/schemas";
import { divHE } from "./money";

export * from "./money";

export const HST_RATE_PCT = 13;

/** Rate per gram for a karat, in cents. 24k is the published rate, the rest derive from it. */
export function rateFor(rate24Cents: number, karat: Karat): number {
  return divHE(rate24Cents * karat, 24);
}

export function allRates(rate24Cents: number) {
  return { 24: rate24Cents, 22: rateFor(rate24Cents, 22), 18: rateFor(rate24Cents, 18), 14: rateFor(rate24Cents, 14) } as Record<Karat, number>;
}

export type PricedPiece = Pick<Piece, "karat" | "netGramsMilli" | "makingBps" | "stoneCents" | "fixedCents" | "category">;

export interface PriceParts {
  fixed: boolean;
  ratePerGramCents: number;
  goldCents: number;
  makingBps: number;
  makingCents: number;
  stoneCents: number;
  totalCents: number;
}

export interface PriceOptions {
  /** Gold bar premium in basis points. Replaces the per piece making charge for the Bars category. */
  barPremiumBps: number;
}

/** Price = net weight x rate(karat) x (1 + making) + stone. Fixed price pieces skip the formula. */
export function priceOf(piece: PricedPiece, rate24Cents: number, opts: PriceOptions): PriceParts {
  if (piece.fixedCents !== undefined && piece.karat === null) {
    return { fixed: true, ratePerGramCents: 0, goldCents: 0, makingBps: 0, makingCents: 0, stoneCents: 0, totalCents: piece.fixedCents };
  }
  const karat = piece.karat ?? 24;
  const ratePerGramCents = rateFor(rate24Cents, karat);
  const goldCents = divHE(piece.netGramsMilli * ratePerGramCents, 1000);
  const makingBps = piece.category === "Bars" ? opts.barPremiumBps : piece.makingBps;
  const makingCents = divHE(goldCents * makingBps, 10000);
  return { fixed: false, ratePerGramCents, goldCents, makingBps, makingCents, stoneCents: piece.stoneCents, totalCents: goldCents + makingCents + piece.stoneCents };
}

export function hstOn(taxableCents: number): number {
  return divHE(taxableCents * HST_RATE_PCT, 100);
}

export interface BagLine {
  unitCents: number;
  qty: number;
  taxFree: boolean;
}

export function bagTotals(lines: BagLine[]) {
  let subtotalCents = 0;
  let taxableCents = 0;
  for (const l of lines) {
    const line = l.unitCents * l.qty;
    subtotalCents += line;
    if (!l.taxFree) taxableCents += line;
  }
  const hstCents = hstOn(taxableCents);
  return { subtotalCents, taxableCents, hstCents, totalCents: subtotalCents + hstCents };
}

/** Calculator on the public site: gold value + making charge, then HST. No stone. */
export function calcEstimate(rate24Cents: number, karat: Karat, gramsMilli: number, makingBps: number) {
  const ratePerGramCents = rateFor(rate24Cents, karat);
  const goldCents = divHE(gramsMilli * ratePerGramCents, 1000);
  const makingCents = divHE(goldCents * makingBps, 10000);
  const hstCents = hstOn(goldCents + makingCents);
  return { ratePerGramCents, goldCents, makingCents, hstCents, totalCents: goldCents + makingCents + hstCents };
}

export function pureGramsMilli(gramsMilli: number, karat: Karat): number {
  return divHE(gramsMilli * karat, 24);
}

/** Buy rate per pure gram, shown to the customer. buyBps is the percent of the 24k rate x 100 (94% is 9400). */
export function buyRatePerGram(rate24Cents: number, buyBps: number): number {
  return divHE(rate24Cents * buyBps, 10000);
}

export function tradeInValue(gramsMilli: number, karat: Karat, rate24Cents: number, buyBps: number) {
  const pureMilli = pureGramsMilli(gramsMilli, karat);
  const buyRateCents = buyRatePerGram(rate24Cents, buyBps);
  return { pureGramsMilli: pureMilli, buyRateCents, valueCents: divHE(pureMilli * buyRateCents, 1000) };
}

export function pieceStatus(p: Pick<Piece, "units" | "unitsReserved" | "unitsSold">): "in_case" | "reserved" | "sold" {
  const available = p.units - p.unitsReserved - p.unitsSold;
  if (available > 0) return "in_case";
  if (p.unitsReserved > 0) return "reserved";
  return "sold";
}

export function availableUnits(p: Pick<Piece, "units" | "unitsReserved" | "unitsSold">): number {
  return Math.max(0, p.units - p.unitsReserved - p.unitsSold);
}
