"use client";

import { useState } from "react";
import { Pill } from "@/components/ui";
import { KARATS, type Karat } from "@/lib/domain/schemas";
import { repo, useOldGold, useSession } from "@/lib/hooks";
import { usePricing } from "@/lib/hooks/pricing";
import { grams, money, parseMilli, tradeInValue } from "@/lib/pricing";
import { periodsFor, shortDate } from "@/lib/time";
import { AField, Btn, Card, Empty, Kpi, QueryView, Table, Toggle, useRun } from "../kit";
import s from "../admin.module.css";

export function OldGoldPage() {
  const q = useOldGold();
  const owner = useSession()?.role === "owner";
  const { rate24, settings } = usePricing();
  const { run, busy } = useRun();
  const [shown, setShown] = useState<Record<string, string>>({});
  const month = periodsFor(new Date())[0]!;
  const rows = q.data ?? [];
  const thisMonth = rows.filter((o) => o.date >= month.from && o.date <= month.to);
  const buyBps = Math.round((settings?.buyRatePct ?? 94) * 100);
  const buyRate = tradeInValue(1000, 24, rate24, buyBps).buyRateCents;
  const melt = rows.filter((o) => o.awaitingMelt).reduce((a, o) => a + o.gramsMilli, 0);

  async function reveal(id: string) {
    const ref = await run(() => repo().oldGold.revealId(id), "ID reference shown. This view was logged.");
    if (ref) {
      setShown((m) => ({ ...m, [id]: ref }));
      setTimeout(() => setShown((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id))), 10000);
    }
  }

  return (
    <>
      <div className={s.kpis}>
        <Kpi label="Bought this month" value={grams(thisMonth.reduce((a, o) => a + o.gramsMilli, 0))} sub={`${thisMonth.length} transaction${thisMonth.length === 1 ? "" : "s"}`} />
        <Kpi label="Paid out" value={money(thisMonth.reduce((a, o) => a + o.paidCents, 0))} sub="at buy rate" />
        <Kpi label="Awaiting melt" value={grams(melt)} sub="grams in the safe" />
        <Kpi label="Buy rate today" value={money(buyRate)} sub="24k per pure gram" />
      </div>
      <div className={s.g2}>
        <Card title="Old gold ledger">
          <QueryView q={q} isEmpty={(d) => d.length === 0} empty={<Empty title="No purchases yet" text="Record the first one with the form." />}>
            {(list) => (
              <Table label="Old gold ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Kt</th>
                    <th className={s.r}>Grams</th>
                    <th className={s.r}>Pure g</th>
                    <th className={s.r}>Paid</th>
                    <th>ID</th>
                    <th>Melt</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={o.id}>
                      <td>{shortDate(o.date)}</td>
                      <td>{o.customer}</td>
                      <td>{o.karat}k</td>
                      <td className={s.r}>{(o.gramsMilli / 1000).toFixed(1)}</td>
                      <td className={s.r}>{(o.pureGramsMilli / 1000).toFixed(2)}</td>
                      <td className={s.r}>{money(o.paidCents)}</td>
                      <td>
                        {o.idChecked ? "Checked" : "Not checked"}
                        {owner ? (
                          shown[o.id] ? (
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{shown[o.id]}</div>
                          ) : (
                            <div>
                              <Btn small variant="line" disabled={busy} onClick={() => reveal(o.id)} aria-label={`Show ID reference for ${o.customer} on ${shortDate(o.date)}`}>
                                Show
                              </Btn>
                            </div>
                          )
                        ) : null}
                      </td>
                      <td>
                        {o.awaitingMelt ? (
                          <Btn small variant="line" disabled={busy} onClick={() => run(() => repo().oldGold.markMelted(o.id), "Marked as melted.")} aria-label={`Mark ${o.customer} ${shortDate(o.date)} as melted`}>
                            Melted
                          </Btn>
                        ) : (
                          <Pill tone="ok">Melted</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryView>
          <p className={s.note}>ID references are hidden here. The owner can show one, and every view is logged.</p>
        </Card>
        <NewPurchase rate24={rate24} buyBps={buyBps} />
      </div>
    </>
  );
}

function NewPurchase({ rate24, buyBps }: { rate24: number; buyBps: number }) {
  const { run, busy } = useRun();
  const [name, setName] = useState("");
  const [karat, setKarat] = useState<Karat>(22);
  const [w, setW] = useState("");
  const [idOk, setIdOk] = useState(false);
  const [idRef, setIdRef] = useState("");
  const gm = parseMilli(w);
  const t = gm && gm > 0 ? tradeInValue(gm, karat, rate24, buyBps) : null;
  const can = !!t && idOk && idRef.trim().length >= 2;
  const why = !t ? "Enter the weight." : !idOk ? "Turn on Photo ID checked to enable the payout." : idRef.trim().length < 2 ? "Add the ID reference." : "";
  async function add() {
    if (!can || !gm) return;
    const r = await run(() => repo().oldGold.add({ customer: name, karat, gramsMilli: gm, idChecked: idOk, idRef }), (x) => `Recorded. Pay ${money(x.paidCents)} (preview, no payment was made).`);
    if (r) {
      setName("");
      setW("");
      setIdOk(false);
      setIdRef("");
    }
  }
  return (
    <Card title="New purchase">
      <form
        className={s.stack}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <AField label="Customer">{(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />}</AField>
        <AField label="Tested karat">
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
        <AField label="Weight (g)">{(p) => <input {...p} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder="12.5" />}</AField>
        <div className={s.sw}>
          <div>
            <b style={{ fontWeight: 500 }}>Photo ID checked and copied</b>
            <small>Required before any payout</small>
          </div>
          <Toggle on={idOk} onChange={setIdOk} label="Photo ID checked and copied" />
        </div>
        <AField label="ID reference" hint="Type and last digits. Seen by the owner only.">
          {(p) => <input {...p} value={idRef} onChange={(e) => setIdRef(e.target.value)} placeholder="Driver's licence ending 4821" />}
        </AField>
        <div className={s.msg} style={{ margin: 0 }} aria-live="polite">
          {t ? (
            <>
              Pays <b>{money(t.valueCents)}</b> at {money(t.buyRateCents)} x {grams(t.pureGramsMilli, 2)} pure gold ({Math.round(buyBps / 100)}% of the 24k rate)
            </>
          ) : (
            "Enter a weight to see what it pays."
          )}
        </div>
        <Btn type="submit" disabled={!can || busy}>
          Record purchase
        </Btn>
        {why ? <p className={s.note} style={{ margin: 0 }}>{why}</p> : null}
      </form>
    </Card>
  );
}

