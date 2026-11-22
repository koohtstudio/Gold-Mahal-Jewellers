import { describe, expect, it } from "vitest";
import { buildBooks, salesByDay } from "@/lib/books/summary";
import { csvCell, hstSummaryCsv, metalCsv, oldGoldCsv, purchasesCsv, salesCsv, toCsv, withBom } from "@/lib/books/csv";
import { buildPdf, buildZip, crc32 } from "@/lib/books/files";
import { buildDownload } from "@/lib/books/pack";
import type { Expense, LedgerEntry, OldGoldPurchase } from "@/lib/domain/schemas";
import { addDays, periodsFor, zonedToDate } from "@/lib/time";

const period = periodsFor(zonedToDate(2026, 11, 21, 12, 0))[0]!;
const led = (o: Partial<LedgerEntry>): LedgerEntry => ({ id: "x", date: "2026-11-10", ref: "INV-1", source: "counter", customer: "Walk in", netCents: 10000, hstCents: 1300, ...o });
const exp = (o: Partial<Expense>): Expense => ({ id: "e1", date: "2026-11-05", vendor: "Vendor", category: "Rent", netCents: 100000, hstCents: 13000, ...o });
const og = (o: Partial<OldGoldPurchase>): OldGoldPurchase => ({ id: "o1", date: "2026-11-08", customer: "Walk in", karat: 22, gramsMilli: 10000, pureGramsMilli: 9167, buyRateCents: 19552, paidCents: 179233, idChecked: true, idRef: "SECRET-ID-123", awaitingMelt: true, ...o });

const data = {
  ledger: [
    led({ id: "a", ref: "INV-1", netCents: 100000, hstCents: 13000, metal: [{ karat: 22, gramsMilli: 5000 }] }),
    led({ id: "b", ref: "INV-2", source: "bullion", netCents: 212160, hstCents: 0, metal: [{ karat: 24, gramsMilli: 10000 }] }),
    led({ id: "c", ref: "LAY-1", source: "layaway", netCents: 50000, hstCents: 6500 }),
    led({ id: "old", date: "2026-10-30", ref: "INV-0", netCents: 999999, hstCents: 130000 }),
    led({ id: "future", date: "2026-12-02", ref: "INV-F", netCents: 5555, hstCents: 722 }),
  ],
  expenses: [
    exp({ id: "e1", category: "Gold purchase", netCents: 980000, hstCents: 127400, metalKarat: 22, metalGramsMilli: 51400 }),
    exp({ id: "e2", category: "Insurance", netCents: 64000, hstCents: 0, date: "2026-11-02" }),
    exp({ id: "e3", date: "2026-10-31", netCents: 123456, hstCents: 16049 }),
  ],
  oldGold: [og({}), og({ id: "o2", date: "2026-10-20" })],
};

describe("books summary", () => {
  const b = buildBooks(period, data);
  it("keeps only rows inside the period", () => {
    expect(b.sales.map((s) => s.id).sort()).toEqual(["a", "b", "c"]);
    expect(b.expenses.map((e) => e.id).sort()).toEqual(["e1", "e2"]);
    expect(b.oldGold.length).toBe(1);
  });
  it("splits jewellery from bullion and counts HST once", () => {
    expect(b.jewelleryNetCents).toBe(150000);
    expect(b.bullionNetCents).toBe(212160);
    expect(b.hstCollectedCents).toBe(19500);
    expect(b.salesTotalCents).toBe(362160 + 19500);
  });
  it("HST to remit is collected minus paid", () => {
    expect(b.hstPaidCents).toBe(127400);
    expect(b.hstToRemitCents).toBe(19500 - 127400);
  });
  it("builds the metal ledger by karat, old gold in and sales out", () => {
    const k22 = b.metal.find((m) => m.karat === 22)!;
    expect(k22.inMilli).toBe(51400 + 10000);
    expect(k22.outMilli).toBe(5000);
    expect(k22.netMilli).toBe(56400);
    expect(b.metal.find((m) => m.karat === 24)).toMatchObject({ inMilli: 0, outMilli: 10000 });
    expect(b.metal.find((m) => m.karat === 18)).toBeUndefined();
  });
  it("totals sales per day for the dashboard", () => {
    const days = salesByDay(data.ledger, "2026-11-12", 3, addDays);
    expect(days.map((d) => d.date)).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(days[0]?.totalCents).toBe(113000 + 212160 + 56500);
    expect(days[2]?.totalCents).toBe(0);
  });
  it("handles an empty period", () => {
    const e = buildBooks(period, { ledger: [], expenses: [], oldGold: [] });
    expect(e.hstToRemitCents).toBe(0);
    expect(e.metal).toEqual([]);
  });
});

describe("csv", () => {
  it("escapes commas, quotes and new lines", () => {
    expect(csvCell('Singh, "Raj"')).toBe('"Singh, ""Raj"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("plain")).toBe("plain");
  });
  it("defuses spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1 call")).toBe("'+1 call");
    expect(csvCell(-5, false)).toBe("-5");
  });
  it("starts the file with a byte order mark and uses ISO dates and two decimals", () => {
    const b = buildBooks(period, data);
    const text = withBom(salesCsv(b));
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("Date,Ref,Customer,Type,Subtotal,HST 13%,Total");
    expect(text).toContain("2026-11-10,INV-1,Walk in,Jewellery,1000.00,130.00,1130.00");
    expect(text).toContain("Bullion,2121.60,0.00,2121.60");
    expect(toCsv([["a", 1]])).toBe("a,1\r\n");
  });
  it("does not export ID references", () => {
    const b = buildBooks(period, data);
    expect(oldGoldCsv(b)).not.toContain("SECRET-ID-123");
    expect(oldGoldCsv(b)).toContain("22k,10.00,9.17,195.52,1792.33,Yes,Yes");
  });
  it("writes QuickBooks and Xero shaped files with unique invoice numbers", () => {
    const b = buildBooks(period, { ...data, ledger: [led({ id: "1", ref: "GM-4821" }), led({ id: "2", ref: "GM-4821", source: "bullion", hstCents: 0 })] });
    const qb = salesCsv(b, "quickbooks");
    expect(qb.split("\r\n")[0]).toContain("*InvoiceNo");
    expect(qb).toContain("GM-4821-2");
    expect(qb).toContain("Exempt");
    expect(salesCsv(b, "xero").split("\r\n")[0]).toContain("*ContactName");
    expect(purchasesCsv(buildBooks(period, data), "quickbooks").split("\r\n")[0]).toContain("*BillNo");
    expect(purchasesCsv(buildBooks(period, data), "xero").split("\r\n")[0]).toContain("*TaxType");
  });
  it("writes the metal ledger and the HST summary", () => {
    const b = buildBooks(period, data);
    expect(metalCsv(b)).toContain("22k,61.40,5.00,56.40");
    expect(hstSummaryCsv(b)).toContain("HST to remit,-1079.00");
    expect(hstSummaryCsv(b)).toContain("not tax advice");
  });
});

describe("zip and pdf", () => {
  it("computes the standard CRC32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("builds a zip with the right entry count and end record", () => {
    const z = buildZip([{ name: "a.csv", data: "hello" }, { name: "b.csv", data: "world" }]);
    const v = new DataView(z.buffer, z.byteOffset);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const eocd = z.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);
    expect(v.getUint16(eocd + 10, true)).toBe(2);
  });
  it("builds a pdf with a header, trailer and a page per 54 lines", () => {
    const text = new TextDecoder().decode(buildPdf(Array.from({ length: 120 }, (_, i) => `line ${i} (with) brackets`)));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Count 3");
    expect(text).toContain("\\(with\\)");
  });
  it("builds the full pack as a zip with every file", () => {
    const b = buildBooks(period, data);
    const d = buildDownload("pack", b, "quickbooks", "Sam");
    expect(d.name).toBe("accountant-pack-november-2026.zip");
    const text = new TextDecoder("latin1").decode(d.data as Uint8Array);
    for (const f of ["summary-november-2026.pdf", "sales-november-2026-quickbooks.csv", "old-gold-purchases-november-2026.csv", "metal-ledger-november-2026.csv", "hst-summary-november-2026.csv", "README.txt"]) expect(text).toContain(f);
    expect(text).not.toContain("SECRET-ID-123");
  });
});
