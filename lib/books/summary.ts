import { KARATS } from "@/lib/domain/constants";
import type { Expense, Karat, LedgerEntry, LedgerSource, OldGoldPurchase } from "@/lib/domain/schemas";
import { inPeriod, type Period } from "@/lib/time";

export const DISCLAIMER = "A working summary for the accountant. It is not tax advice. Please confirm treatment of bullion, trade-ins and layaway with your accountant.";

export const SOURCE_LABEL: Record<LedgerSource, string> = {
  reservation: "Jewellery",
  counter: "Jewellery",
  bullion: "Bullion",
  layaway: "Layaway payment",
  job: "Job deposit",
};

export interface MetalRow {
  karat: Karat;
  inMilli: number;
  outMilli: number;
  netMilli: number;
}

export interface BooksSummary {
  period: Pick<Period, "from" | "to" | "label">;
  sales: LedgerEntry[];
  jewelleryNetCents: number;
  bullionNetCents: number;
  salesNetCents: number;
  hstCollectedCents: number;
  salesTotalCents: number;
  jewelleryCount: number;
  expenses: Expense[];
  expensesNetCents: number;
  hstPaidCents: number;
  expensesTotalCents: number;
  hstToRemitCents: number;
  oldGold: OldGoldPurchase[];
  oldGoldPaidCents: number;
  oldGoldGramsMilli: number;
  metal: MetalRow[];
}

const sum = <T>(a: T[], f: (x: T) => number) => a.reduce((t, x) => t + f(x), 0);
const byDateDesc = <T extends { date: string }>(a: T[]) => [...a].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));

/** Rolls the ledger, expenses and old gold for one period into the numbers the accountant needs. All integer cents. */
export function buildBooks(period: Pick<Period, "from" | "to" | "label">, data: { ledger: LedgerEntry[]; expenses: Expense[]; oldGold: OldGoldPurchase[] }): BooksSummary {
  const sales = byDateDesc(data.ledger.filter((e) => inPeriod(e.date, period)));
  const expenses = byDateDesc(data.expenses.filter((e) => inPeriod(e.date, period)));
  const oldGold = byDateDesc(data.oldGold.filter((o) => inPeriod(o.date, period)));
  const jewelleryNetCents = sum(sales.filter((e) => e.source !== "bullion"), (e) => e.netCents);
  const bullionNetCents = sum(sales.filter((e) => e.source === "bullion"), (e) => e.netCents);
  const hstCollectedCents = sum(sales, (e) => e.hstCents);
  const salesNetCents = jewelleryNetCents + bullionNetCents;
  const expensesNetCents = sum(expenses, (e) => e.netCents);
  const hstPaidCents = sum(expenses, (e) => e.hstCents);

  const metal: MetalRow[] = KARATS.map((karat) => {
    const inMilli = sum(expenses.filter((e) => e.metalKarat === karat), (e) => e.metalGramsMilli ?? 0) + sum(oldGold.filter((o) => o.karat === karat), (o) => o.gramsMilli);
    const outMilli = sum(sales, (e) => sum((e.metal ?? []).filter((m) => m.karat === karat), (m) => m.gramsMilli));
    return { karat, inMilli, outMilli, netMilli: inMilli - outMilli };
  }).filter((r) => r.inMilli > 0 || r.outMilli > 0);

  return {
    period, sales, jewelleryNetCents, bullionNetCents, salesNetCents, hstCollectedCents, salesTotalCents: salesNetCents + hstCollectedCents,
    jewelleryCount: sales.filter((e) => e.source !== "bullion").length, expenses, expensesNetCents, hstPaidCents, expensesTotalCents: expensesNetCents + hstPaidCents,
    hstToRemitCents: hstCollectedCents - hstPaidCents, oldGold, oldGoldPaidCents: sum(oldGold, (o) => o.paidCents), oldGoldGramsMilli: sum(oldGold, (o) => o.gramsMilli), metal,
  };
}

/** Sales in the last `days` days ending today, one total (net plus HST) per calendar day, oldest first. */
export function salesByDay(ledger: LedgerEntry[], today: string, days: number, addDays: (iso: string, n: number) => string): Array<{ date: string; totalCents: number }> {
  const out: Array<{ date: string; totalCents: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({ date, totalCents: sum(ledger.filter((e) => e.date === date), (e) => e.netCents + e.hstCents) });
  }
  return out;
}
