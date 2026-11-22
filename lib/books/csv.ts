import type { ExportFormat } from "@/lib/domain/schemas";
import { plain } from "@/lib/pricing";
import { shortDate } from "@/lib/time";
import { DISCLAIMER, SOURCE_LABEL, type BooksSummary } from "./summary";

type Cell = string | number | boolean | undefined | null;

/** Quote when needed. Text that starts with = + - or @ is prefixed so a spreadsheet never runs it as a formula. */
export function csvCell(v: Cell, isText = true): string {
  if (v === undefined || v === null) return "";
  let s = String(v);
  const looksNumeric = /^-?\d+(\.\d+)?$/.test(s);
  if (isText && typeof v === "string" && !looksNumeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map((c) => csvCell(c)).join(",")).join("\r\n") + "\r\n";
}

/** UTF-8 with a byte order mark, so Excel opens accents correctly. */
export const withBom = (text: string) => `﻿${text}`;

const m2 = plain;
const g2 = (milli: number) => (milli / 1000).toFixed(2);

function uniqueRefs(rows: BooksSummary["sales"]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const n = (seen.get(r.ref) ?? 0) + 1;
    seen.set(r.ref, n);
    return n === 1 ? r.ref : `${r.ref}-${n}`;
  });
}

export function salesCsv(b: BooksSummary, format: ExportFormat = "standard"): string {
  const refs = uniqueRefs(b.sales);
  if (format === "quickbooks") {
    return toCsv([
      ["*InvoiceNo", "*Customer", "*InvoiceDate", "*DueDate", "Terms", "Memo", "Item(Product/Service)", "ItemDescription", "ItemQuantity", "ItemRate", "*ItemAmount", "*ItemTaxCode", "*ItemTaxAmount"],
      ...b.sales.map((r, i) => [refs[i], r.customer, r.date, r.date, "Due on receipt", SOURCE_LABEL[r.source], r.source === "bullion" ? "Bullion sales" : "Jewellery sales", SOURCE_LABEL[r.source], 1, m2(r.netCents), m2(r.netCents), r.hstCents === 0 ? "Exempt" : "HST ON", m2(r.hstCents)]),
    ]);
  }
  if (format === "xero") {
    return toCsv([
      ["*ContactName", "*InvoiceNumber", "*InvoiceDate", "*DueDate", "*Description", "*Quantity", "*UnitAmount", "*AccountCode", "*TaxType"],
      ...b.sales.map((r, i) => [r.customer, refs[i], r.date, r.date, SOURCE_LABEL[r.source], 1, m2(r.netCents), r.source === "bullion" ? "210" : "200", r.hstCents === 0 ? "Exempt" : "HST on Income"]),
    ]);
  }
  return toCsv([["Date", "Ref", "Customer", "Type", "Subtotal", "HST 13%", "Total"], ...b.sales.map((r) => [r.date, r.ref, r.customer, SOURCE_LABEL[r.source], m2(r.netCents), m2(r.hstCents), m2(r.netCents + r.hstCents)])]);
}

export function purchasesCsv(b: BooksSummary, format: ExportFormat = "standard", includeInvoiceRefs = true): string {
  if (format === "quickbooks") {
    return toCsv([
      ["*BillNo", "*Vendor", "*BillDate", "*DueDate", "Terms", "*Account", "LineDescription", "*LineAmount", "LineTaxCode", "LineTaxAmount"],
      ...b.expenses.map((e) => [`EXP-${e.id}`, e.vendor, e.date, e.date, "Due on receipt", e.category, e.category, m2(e.netCents), e.hstCents === 0 ? "Exempt" : "HST ON", m2(e.hstCents)]),
    ]);
  }
  if (format === "xero") {
    return toCsv([
      ["*ContactName", "*InvoiceNumber", "*InvoiceDate", "*DueDate", "*Description", "*Quantity", "*UnitAmount", "*AccountCode", "*TaxType"],
      ...b.expenses.map((e) => [e.vendor, `EXP-${e.id}`, e.date, e.date, e.category, 1, m2(e.netCents), e.category === "Rent" ? "400" : e.category === "Gold purchase" ? "310" : "300", e.hstCents === 0 ? "Exempt" : "HST on Expenses"]),
    ]);
  }
  return toCsv([
    ["Date", "Vendor", "Category", "Subtotal", "HST (ITC)", "Total", "Metal karat", "Metal grams", ...(includeInvoiceRefs ? ["Invoice photo"] : [])],
    ...b.expenses.map((e) => [e.date, e.vendor, e.category, m2(e.netCents), m2(e.hstCents), m2(e.netCents + e.hstCents), e.metalKarat ? `${e.metalKarat}k` : "", e.metalGramsMilli ? g2(e.metalGramsMilli) : "", ...(includeInvoiceRefs ? [e.invoiceUrl ? "Attached" : ""] : [])]),
  ]);
}

/** ID references are never exported. */
export function oldGoldCsv(b: BooksSummary): string {
  return toCsv([
    ["Date", "Customer", "Karat", "Grams", "Pure grams", "Buy rate per pure gram", "Paid", "Photo ID checked", "Awaiting melt"],
    ...b.oldGold.map((o) => [o.date, o.customer, `${o.karat}k`, g2(o.gramsMilli), g2(o.pureGramsMilli), m2(o.buyRateCents), m2(o.paidCents), o.idChecked ? "Yes" : "No", o.awaitingMelt ? "Yes" : "No"]),
  ]);
}

export function metalCsv(b: BooksSummary): string {
  return toCsv([["Karat", "Bought in (g)", "Sold out (g)", "Net change (g)"], ...b.metal.map((r) => [`${r.karat}k`, g2(r.inMilli), g2(r.outMilli), g2(r.netMilli)])]);
}

export function hstSummaryCsv(b: BooksSummary, businessName = "Gold Mahal Jewellers"): string {
  return toCsv([
    [businessName],
    [`Period`, b.period.label],
    [`From`, b.period.from],
    [`To`, b.period.to],
    [],
    ["Jewellery sales before HST", m2(b.jewelleryNetCents)],
    ["Bullion sales (HST exempt, confirm with accountant)", m2(b.bullionNetCents)],
    ["HST collected", m2(b.hstCollectedCents)],
    ["Purchases and expenses before HST", m2(b.expensesNetCents)],
    ["HST paid (input tax credits)", m2(b.hstPaidCents)],
    ["HST to remit", m2(b.hstToRemitCents)],
    ["Old gold bought from customers", m2(b.oldGoldPaidCents)],
    [],
    [DISCLAIMER],
  ]);
}

export const FORMAT_LABEL: Record<ExportFormat, string> = { standard: "Standard CSV", quickbooks: "QuickBooks ready CSV", xero: "Xero ready CSV", pdf: "PDF summary" };

export function pdfLines(b: BooksSummary, accountant: string): string[] {
  const money = (c: number) => `$${m2(c)}`;
  const L: string[] = [];
  L.push(`Gold Mahal Jewellers: books for ${b.period.label}`);
  L.push(`Prepared for ${accountant}. ${b.period.from} to ${b.period.to}.`);
  L.push("");
  L.push("SUMMARY");
  L.push(`Jewellery sales before HST: ${money(b.jewelleryNetCents)}`);
  L.push(`Bullion sales (HST exempt, confirm): ${money(b.bullionNetCents)}`);
  L.push(`HST collected: ${money(b.hstCollectedCents)}`);
  L.push(`Purchases and expenses before HST: ${money(b.expensesNetCents)}`);
  L.push(`HST paid (input tax credits): ${money(b.hstPaidCents)}`);
  L.push(`HST to remit: ${money(b.hstToRemitCents)}`);
  L.push(`Old gold bought from customers: ${money(b.oldGoldPaidCents)} for ${g2(b.oldGoldGramsMilli)} g`);
  L.push("");
  L.push("METAL LEDGER (grams)");
  for (const r of b.metal) L.push(`${r.karat}k  in ${g2(r.inMilli)}  out ${g2(r.outMilli)}  net ${g2(r.netMilli)}`);
  L.push("");
  L.push("SALES");
  for (const r of b.sales) L.push(`${shortDate(r.date)}  ${r.ref}  ${r.customer}  ${SOURCE_LABEL[r.source]}  ${money(r.netCents)} + HST ${money(r.hstCents)}`);
  L.push("");
  L.push("PURCHASES AND EXPENSES");
  for (const e of b.expenses) L.push(`${shortDate(e.date)}  ${e.vendor}  ${e.category}  ${money(e.netCents)} + HST ${money(e.hstCents)}`);
  L.push("");
  L.push(DISCLAIMER);
  return L;
}
