"use client";

import { useMemo, useState } from "react";
import { Icon, Pill } from "@/components/ui";
import { FORMAT_LABEL } from "@/lib/books/csv";
import { buildDownload, pdfDownload, type DownloadKind } from "@/lib/books/pack";
import { buildBooks, DISCLAIMER, SOURCE_LABEL } from "@/lib/books/summary";
import { EXPENSE_CATEGORIES, KARATS } from "@/lib/domain/constants";
import type { ExpenseCategory, ExportFormat, Karat } from "@/lib/domain/schemas";
import { repo, useAccountant, useExpenses, useLedger, useOldGold, useSendHistory } from "@/lib/hooks";
import { grams, hstOn, money, parseCents, parseMilli } from "@/lib/pricing";
import { periodsFor, shortDate, whenLabel, type PeriodKey } from "@/lib/time";
import { downloadFile } from "@/lib/ui/download";
import { AField, Btn, Card, Empty, Kpi, OwnerOnly, QueryView, SwitchRow, Table, Tabs, useRun } from "../kit";
import s from "../admin.module.css";

export function BooksPage() {
  return (
    <OwnerOnly what="The books">
      <BooksInner />
    </OwnerOnly>
  );
}

function BooksInner() {
  const periods = useMemo(() => periodsFor(new Date()), []);
  const [pk, setPk] = useState<PeriodKey>("this-month");
  const period = periods.find((p) => p.key === pk) ?? periods[0]!;
  const ledgerQ = useLedger(period);
  const expQ = useExpenses(period);
  const ogQ = useOldGold();
  const acctQ = useAccountant();
  const histQ = useSendHistory();
  const { run, busy } = useRun();
  const acct = acctQ.data;

  const books = useMemo(() => buildBooks(period, { ledger: ledgerQ.data ?? [], expenses: expQ.data ?? [], oldGold: ogQ.data ?? [] }), [period, ledgerQ.data, expQ.data, ogQ.data]);
  const first = acct?.name.trim().split(/\s+/)[0] || "your accountant";
  const format: ExportFormat = acct?.format ?? "standard";

  async function download(kind: DownloadKind | "pdf") {
    if (!acct) return;
    const d = kind === "pdf" ? pdfDownload(books, acct.name) : buildDownload(kind, books, format, acct.name, { includeInvoiceRefs: acct.includeReceipts });
    downloadFile(d.name, d.mime, d.data);
    await run(() => repo().books.logExport(kind, period), `${d.name} downloaded.`);
  }

  return (
    <>
      <Tabs label="Period" value={pk} onChange={setPk} tabs={periods.map((p) => ({ key: p.key, label: p.label }))} />
      <div className={`${s.kpis} ${s.k5}`}>
        <Kpi label="Jewellery sales" value={money(books.jewelleryNetCents)} sub={`${books.jewelleryCount} sales, before HST`} />
        <Kpi label="Bullion sales" value={money(books.bullionNetCents)} sub="HST exempt (confirm)" />
        <Kpi label="HST collected" value={money(books.hstCollectedCents)} sub="13% on jewellery" />
        <Kpi label="Purchases and expenses" value={money(books.expensesNetCents)} sub={`${books.expenses.length} bills, HST paid ${money(books.hstPaidCents)}`} />
        <Kpi label="HST to remit" value={money(books.hstToRemitCents)} sub="collected minus paid" hl />
      </div>
      <div className={s.g2}>
        <div className={s.stack}>
          <Card title="Sales ledger">
            <QueryView q={ledgerQ} isEmpty={(d) => d.length === 0} empty={<Empty title="No sales in this period" text="Sales appear when a reservation is marked sold, a counter sale is recorded or a layaway payment is taken." />}>
              {() => (
                <Table label="Sales ledger">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref</th>
                      <th>Customer</th>
                      <th>Type</th>
                      <th className={s.r}>Subtotal</th>
                      <th className={s.r}>HST</th>
                      <th className={s.r}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.sales.map((r) => (
                      <tr key={r.id}>
                        <td>{shortDate(r.date)}</td>
                        <td>{r.ref}</td>
                        <td>{r.customer}</td>
                        <td>{SOURCE_LABEL[r.source]}</td>
                        <td className={s.r}>{money(r.netCents)}</td>
                        <td className={s.r}>{money(r.hstCents)}</td>
                        <td className={s.r}>{money(r.netCents + r.hstCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Total</td>
                      <td className={s.r}>{money(books.salesNetCents)}</td>
                      <td className={s.r}>{money(books.hstCollectedCents)}</td>
                      <td className={s.r}>{money(books.salesTotalCents)}</td>
                    </tr>
                  </tfoot>
                </Table>
              )}
            </QueryView>
          </Card>
          <Card title="Purchases and expenses">
            <QueryView q={expQ} isEmpty={(d) => d.length === 0} empty={<Empty title="No bills in this period" text="Add a supplier bill or expense below." />}>
              {() => (
                <Table label="Purchases and expenses">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vendor</th>
                      <th>Category</th>
                      <th className={s.r}>Subtotal</th>
                      <th className={s.r}>HST</th>
                      <th className={s.r}>Total</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.expenses.map((r) => (
                      <tr key={r.id}>
                        <td>{shortDate(r.date)}</td>
                        <td>{r.vendor}</td>
                        <td>{r.category}</td>
                        <td className={s.r}>{money(r.netCents)}</td>
                        <td className={s.r}>{money(r.hstCents)}</td>
                        <td className={s.r}>{money(r.netCents + r.hstCents)}</td>
                        <td>{r.invoiceUrl ? "Photo attached" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </QueryView>
            <AddExpense onAdded={() => pk === "last-month" && setPk("this-month")} />
          </Card>
          <Card title="Metal ledger, grams">
            {books.metal.length === 0 ? (
              <Empty title="No metal moved in this period" />
            ) : (
              <Table label="Metal ledger">
                <thead>
                  <tr>
                    <th>Karat</th>
                    <th className={s.r}>Bought in</th>
                    <th className={s.r}>Sold out</th>
                    <th className={s.r}>Net change</th>
                  </tr>
                </thead>
                <tbody>
                  {books.metal.map((m) => (
                    <tr key={m.karat}>
                      <td>{m.karat}k</td>
                      <td className={s.r}>{grams(m.inMilli)}</td>
                      <td className={s.r}>{grams(m.outMilli)}</td>
                      <td className={s.r}>
                        {m.netMilli >= 0 ? "+" : ""}
                        {grams(m.netMilli)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className={s.note}>Gold in and out by weight, including old gold bought from customers. Accountants and insurers ask for this.</p>
          </Card>
        </div>
        <div className={s.stack}>
          <Card title="Send to your accountant">
            <button type="button" className={s.send} disabled={busy || !acct} onClick={() => acct && run(() => repo().ports.accountant.send(period, format), `Sent ${period.label} books to ${acct.email} (preview, nothing was sent).`)}>
              <Icon name="send" size={22} /> Send {period.short} books to {first}
            </button>
            <p className={s.note}>One tap sends sales, purchases, old gold buys, the metal ledger and the HST summary to {acct?.email ?? "your accountant"}. Format: {FORMAT_LABEL[format]}.</p>
            <QueryView q={histQ} isEmpty={(d) => d.length === 0} empty={<p className={s.note}>Nothing sent yet.</p>}>
              {(h) => (
                <ul className={s.hist} aria-label="Send history">
                  {h.slice(0, 6).map((x) => (
                    <li key={x.id}>
                      <span>
                        <b style={{ fontWeight: 500 }}>
                          {x.periodLabel} books ({FORMAT_LABEL[x.format]})
                        </b>
                        <br />
                        <small>{x.to}</small>
                      </span>
                      <Pill tone="ok">Sent {whenLabel(x.sentAt)}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </QueryView>
          </Card>
          <Card title="Download">
            <div style={{ display: "grid", gap: 8 }}>
              {(
                [
                  ["sales", "Sales ledger (CSV)", "Jewellery and bullion, HST split out"],
                  ["purchases", "Purchases and expenses (CSV)", "Supplier bills and input tax credits"],
                  ["old-gold", "Old gold purchases (CSV)", "Weight, purity, price paid, ID checked"],
                  ["pack", "Full accountant pack (zip)", "Everything above, the metal ledger, the HST summary and a PDF"],
                  ["pdf", "PDF summary", "One page of numbers for the accountant"],
                ] as Array<[DownloadKind | "pdf", string, string]>
              ).map(([k, t, sub]) => (
                <button key={k} type="button" className={s.xbtn} onClick={() => download(k)} disabled={!acct}>
                  <Icon name="download" size={20} />
                  <span>
                    {t}
                    <small>{sub}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className={s.note}>Files use UTF-8, ISO dates and money to two decimals. {DISCLAIMER}</p>
          </Card>
          <AccountantCard />
        </div>
      </div>
    </>
  );
}

function AddExpense({ onAdded }: { onAdded: () => void }) {
  const { run, busy } = useRun();
  const [vendor, setVendor] = useState("");
  const [amt, setAmt] = useState("");
  const [cat, setCat] = useState<ExpenseCategory>("Gold purchase");
  const [hst, setHst] = useState("");
  const [karat, setKarat] = useState<Karat>(22);
  const [g, setG] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const net = parseCents(amt);
  const autoHst = net === null ? 0 : cat === "Insurance" ? 0 : hstOn(net);
  const hstOverride = hst.trim() === "" ? null : parseCents(hst);
  const errs = { vendor: vendor.trim().length < 2 ? "Enter the vendor." : null, amt: net === null || net <= 0 ? "Enter the amount before HST." : null, hst: hst.trim() !== "" && hstOverride === null ? "Enter a number." : null };
  async function add() {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const gm = parseMilli(g);
    const r = await run(
      () => repo().books.addExpense({ vendor, category: cat, netCents: net as number, ...(hstOverride !== null ? { hstCents: hstOverride } : {}), ...(photo ? { invoiceUrl: photo } : {}), ...(cat === "Gold purchase" && gm ? { metalKarat: karat, metalGramsMilli: gm } : {}) }),
      "Added to the books.",
    );
    if (r) {
      setVendor("");
      setAmt("");
      setHst("");
      setG("");
      setPhoto(null);
      setTouched(false);
      onAdded();
    }
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
      style={{ marginTop: 16, display: "grid", gap: 12 }}
      aria-label="Add a purchase or expense"
    >
      <div className={s.ex}>
        <AField label="Vendor" error={touched ? errs.vendor : null}>{(p) => <input {...p} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Supplier name" />}</AField>
        <AField label="Amount before HST ($)" error={touched ? errs.amt : null}>{(p) => <input {...p} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="2500.00" />}</AField>
        <AField label="Category">
          {(p) => (
            <select {...p} value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </AField>
      </div>
      <div className={s.ex}>
        <AField label="HST paid ($)" hint={`Left blank it is ${money(autoHst)}${cat === "Insurance" ? " (insurance usually has none)" : ""}.`} error={touched ? errs.hst : null}>
          {(p) => <input {...p} inputMode="decimal" value={hst} onChange={(e) => setHst(e.target.value)} placeholder={(autoHst / 100).toFixed(2)} />}
        </AField>
        {cat === "Gold purchase" ? (
          <>
            <AField label="Karat bought">
              {(p) => (
                <select {...p} value={karat} onChange={(e) => setKarat(Number(e.target.value) as Karat)}>
                  {KARATS.map((k) => (
                    <option key={k} value={k}>
                      {k}k
                    </option>
                  ))}
                </select>
              )}
            </AField>
            <AField label="Grams bought" hint="Feeds the metal ledger">
              {(p) => <input {...p} inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} placeholder="51.4" />}
            </AField>
          </>
        ) : null}
      </div>
      <AField label="Invoice photo" hint={photo ? "Photo attached." : "Take or choose a photo of the bill."}>
        {(p) => (
          <input
            {...p}
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const ref = await run(() => repo().ports.storage.put(f, "invoice"), "Invoice photo attached.");
              if (ref) setPhoto(ref);
            }}
          />
        )}
      </AField>
      <div>
        <Btn type="submit" disabled={busy}>
          Add to books
        </Btn>
      </div>
    </form>
  );
}

function AccountantCard() {
  const q = useAccountant();
  const { run } = useRun();
  const a = q.data;
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const save = (patch: Parameters<ReturnType<typeof repo>["ports"]["accountant"]["update"]>[0]) => run(() => repo().ports.accountant.update(patch), "Saved.");
  if (!a) return <Card title="Accountant">{q.error ? <p className={s.note}>{q.error}</p> : <p className={s.note}>Loading</p>}</Card>;
  return (
    <Card title="Accountant">
      <div style={{ display: "grid", gap: 12 }}>
        <AField label="Name">{(p) => <input {...p} key={a.name} defaultValue={a.name} onBlur={(e) => e.target.value !== a.name && save({ name: e.target.value })} />}</AField>
        <AField label="Email" error={emailErr}>
          {(p) => (
            <input
              {...p}
              key={a.email}
              type="email"
              defaultValue={a.email}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (!/^\S+@\S+\.\S+$/.test(v)) return setEmailErr("Enter a valid email address.");
                setEmailErr(null);
                if (v !== a.email) save({ email: v });
              }}
            />
          )}
        </AField>
        <AField label="Format">
          {(p) => (
            <select {...p} value={a.format} onChange={(e) => save({ format: e.target.value as ExportFormat })}>
              {(Object.keys(FORMAT_LABEL) as ExportFormat[]).map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          )}
        </AField>
        <SwitchRow title="Send on the 1st of every month" sub="Automatic, with last month's books" on={a.autoSend} onChange={(v) => save({ autoSend: v })} />
        <SwitchRow title="Include invoice photos" sub="Attached to the purchase rows" on={a.includeReceipts} onChange={(v) => save({ includeReceipts: v })} />
        <p className={s.note} style={{ margin: 0 }}>
          The name and email here are a placeholder. HST treatment of bullion, trade-ins and layaway is shown as sample. Confirm with your accountant.
        </p>
      </div>
    </Card>
  );
}
