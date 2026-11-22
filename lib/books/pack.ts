import type { ExportFormat } from "@/lib/domain/schemas";
import { FORMAT_LABEL, hstSummaryCsv, metalCsv, oldGoldCsv, pdfLines, purchasesCsv, salesCsv, withBom } from "./csv";
import { buildPdf, buildZip } from "./files";
import { DISCLAIMER, type BooksSummary } from "./summary";

export interface Download {
  name: string;
  mime: string;
  data: Uint8Array | string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type DownloadKind = "sales" | "purchases" | "old-gold" | "pack";

/** A CSV download is a real file: UTF-8 with a byte order mark, ISO dates, money to two decimals. */
export function buildDownload(kind: DownloadKind, b: BooksSummary, format: ExportFormat, accountant: string, opts: { includeInvoiceRefs?: boolean } = {}): Download {
  const p = slug(b.period.label);
  const csvFormat = format === "pdf" ? "standard" : format;
  const tag = csvFormat === "standard" ? "" : `-${csvFormat}`;
  if (kind === "sales") return { name: `sales-${p}${tag}.csv`, mime: "text/csv;charset=utf-8", data: withBom(salesCsv(b, csvFormat)) };
  if (kind === "purchases") return { name: `purchases-and-expenses-${p}${tag}.csv`, mime: "text/csv;charset=utf-8", data: withBom(purchasesCsv(b, csvFormat, opts.includeInvoiceRefs ?? true)) };
  if (kind === "old-gold") return { name: `old-gold-purchases-${p}.csv`, mime: "text/csv;charset=utf-8", data: withBom(oldGoldCsv(b)) };
  const files = [
    { name: `summary-${p}.pdf`, data: buildPdf(pdfLines(b, accountant), `Books ${b.period.label}`) },
    { name: `sales-${p}${tag}.csv`, data: withBom(salesCsv(b, csvFormat)) },
    { name: `purchases-and-expenses-${p}${tag}.csv`, data: withBom(purchasesCsv(b, csvFormat, opts.includeInvoiceRefs ?? true)) },
    { name: `old-gold-purchases-${p}.csv`, data: withBom(oldGoldCsv(b)) },
    { name: `metal-ledger-${p}.csv`, data: withBom(metalCsv(b)) },
    { name: `hst-summary-${p}.csv`, data: withBom(hstSummaryCsv(b)) },
    { name: "README.txt", data: `Gold Mahal Jewellers, ${b.period.label}\nFormat: ${FORMAT_LABEL[format]}\n\n${DISCLAIMER}\n` },
  ];
  return { name: `accountant-pack-${p}.zip`, mime: "application/zip", data: buildZip(files) };
}

export function pdfDownload(b: BooksSummary, accountant: string): Download {
  return { name: `books-${slug(b.period.label)}.pdf`, mime: "application/pdf", data: buildPdf(pdfLines(b, accountant), `Books ${b.period.label}`) };
}
