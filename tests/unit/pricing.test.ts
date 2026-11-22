import { describe, expect, it } from "vitest";
import { allRates, availableUnits, bagTotals, buyRatePerGram, calcEstimate, divHE, hstOn, money, moneyWhole, parseCents, parseMilli, pieceStatus, plain, priceOf, rateFor, tradeInValue } from "@/lib/pricing";

const R24 = 20800; // $208.00 sample rate
const opts = { barPremiumBps: 200 };
const base = { stoneCents: 0, fixedCents: undefined } as const;

describe("rounding", () => {
  it("rounds half to even", () => {
    expect(divHE(5, 2)).toBe(2);
    expect(divHE(7, 2)).toBe(4);
    expect(divHE(15, 10)).toBe(2);
    expect(divHE(25, 10)).toBe(2);
    expect(divHE(35, 10)).toBe(4);
    expect(divHE(26, 10)).toBe(3);
    expect(divHE(24, 10)).toBe(2);
  });
  it("handles zero and negatives", () => {
    expect(divHE(0, 7)).toBe(0);
    expect(divHE(-5, 2)).toBe(-2);
    expect(divHE(-7, 2)).toBe(-4);
  });
  it("rejects a zero divisor", () => {
    expect(() => divHE(1, 0)).toThrow();
  });
});

describe("rate per karat", () => {
  it("derives 22k, 18k and 14k from 24k and rounds to the cent", () => {
    expect(rateFor(R24, 24)).toBe(20800);
    expect(rateFor(R24, 22)).toBe(19067);
    expect(rateFor(R24, 18)).toBe(15600);
    expect(rateFor(R24, 14)).toBe(12133);
    expect(allRates(R24)[22]).toBe(19067);
  });
});

describe("priceOf", () => {
  it("matches the CONTENT.md sample prices", () => {
    const balis = priceOf({ ...base, karat: 22, netGramsMilli: 1600, makingBps: 1400, category: "Earrings" }, R24, opts);
    expect(balis.goldCents).toBe(30507);
    expect(balis.makingCents).toBe(4271);
    expect(balis.totalCents).toBe(34778);
    const jhumka = priceOf({ ...base, karat: 22, netGramsMilli: 9600, makingBps: 900, category: "Earrings" }, R24, opts);
    expect(jhumka.totalCents).toBe(199517);
    const cuban = priceOf({ ...base, karat: 22, netGramsMilli: 18400, makingBps: 500, category: "Chains" }, R24, opts);
    expect(moneyWhole(cuban.totalCents)).toBe("$3,684");
    const bridal = priceOf({ ...base, karat: 22, netGramsMilli: 42000, makingBps: 700, category: "Bridal" }, R24, opts);
    expect(moneyWhole(bridal.totalCents)).toBe("$8,569");
  });
  it("adds the stone after making, never making on the stone", () => {
    const ring = priceOf({ karat: 18, netGramsMilli: 3100, makingBps: 1200, stoneCents: 141700, fixedCents: undefined, category: "Diamonds" }, R24, opts);
    expect(ring.goldCents).toBe(48360);
    expect(ring.makingCents).toBe(5803);
    expect(ring.totalCents).toBe(48360 + 5803 + 141700);
  });
  it("skips the formula for fixed price pieces", () => {
    const m = priceOf({ karat: null, netGramsMilli: 0, makingBps: 0, stoneCents: 0, fixedCents: 65000, category: "Diamonds" }, R24, opts);
    expect(m.fixed).toBe(true);
    expect(m.totalCents).toBe(65000);
    const other = priceOf({ karat: null, netGramsMilli: 0, makingBps: 0, stoneCents: 0, fixedCents: 65000, category: "Diamonds" }, 99999, opts);
    expect(other.totalCents).toBe(65000);
  });
  it("uses the bar premium for the Bars category, not the piece making field", () => {
    const bar = priceOf({ ...base, karat: 24, netGramsMilli: 10000, makingBps: 9999, category: "Bars" }, R24, opts);
    expect(bar.goldCents).toBe(208000);
    expect(bar.makingCents).toBe(4160);
    expect(bar.totalCents).toBe(212160);
    expect(priceOf({ ...base, karat: 24, netGramsMilli: 10000, makingBps: 0, category: "Bars" }, R24, { barPremiumBps: 0 }).totalCents).toBe(208000);
  });
  it("moves every price when the rate moves", () => {
    const p = { ...base, karat: 22 as const, netGramsMilli: 5000, makingBps: 800, category: "Chains" as const };
    expect(priceOf(p, 21800, opts).totalCents).toBeGreaterThan(priceOf(p, R24, opts).totalCents);
  });
});

describe("HST", () => {
  it("is 13 percent, rounded half to even once per document", () => {
    expect(hstOn(10000)).toBe(1300);
    expect(hstOn(50)).toBe(6);
    expect(hstOn(150)).toBe(20);
    expect(hstOn(0)).toBe(0);
  });
  it("exempts tax free lines (gold bars) from HST", () => {
    const t = bagTotals([
      { unitCents: 34778, qty: 2, taxFree: false },
      { unitCents: 212160, qty: 1, taxFree: true },
    ]);
    expect(t.subtotalCents).toBe(34778 * 2 + 212160);
    expect(t.taxableCents).toBe(34778 * 2);
    expect(t.hstCents).toBe(hstOn(34778 * 2));
    expect(t.totalCents).toBe(t.subtotalCents + t.hstCents);
  });
  it("is zero for an empty bag", () => {
    expect(bagTotals([])).toEqual({ subtotalCents: 0, taxableCents: 0, hstCents: 0, totalCents: 0 });
  });
});

describe("calculator and trade in", () => {
  it("itemises gold, making and HST", () => {
    const e = calcEstimate(R24, 22, 5000, 800);
    expect(e.goldCents).toBe(95335);
    expect(e.makingCents).toBe(7627);
    expect(e.hstCents).toBe(hstOn(95335 + 7627));
    expect(e.totalCents).toBe(95335 + 7627 + e.hstCents);
  });
  it("values old gold at pure grams x displayed buy rate", () => {
    expect(buyRatePerGram(R24, 9400)).toBe(19552);
    const t = tradeInValue(10000, 22, R24, 9400);
    expect(t.pureGramsMilli).toBe(9167);
    expect(t.valueCents).toBe(179233);
  });
  it("pays more for higher karat at the same weight", () => {
    expect(tradeInValue(10000, 24, R24, 9400).valueCents).toBeGreaterThan(tradeInValue(10000, 18, R24, 9400).valueCents);
  });
});

describe("stock status", () => {
  it("derives status from units", () => {
    expect(pieceStatus({ units: 1, unitsReserved: 0, unitsSold: 0 })).toBe("in_case");
    expect(pieceStatus({ units: 1, unitsReserved: 1, unitsSold: 0 })).toBe("reserved");
    expect(pieceStatus({ units: 1, unitsReserved: 0, unitsSold: 1 })).toBe("sold");
    expect(pieceStatus({ units: 3, unitsReserved: 1, unitsSold: 1 })).toBe("in_case");
    expect(availableUnits({ units: 3, unitsReserved: 1, unitsSold: 1 })).toBe(1);
  });
});

describe("formatting and parsing", () => {
  it("formats money", () => {
    expect(money(123456)).toBe("$1,234.56");
    expect(moneyWhole(123456)).toBe("$1,235");
    expect(plain(5)).toBe("0.05");
    expect(plain(-12345)).toBe("-123.45");
  });
  it("parses user input to integers", () => {
    expect(parseCents("$1,250.50")).toBe(125050);
    expect(parseMilli("12.4")).toBe(12400);
    expect(parseCents("abc")).toBeNull();
    expect(parseCents("")).toBeNull();
  });
});
