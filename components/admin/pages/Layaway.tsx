"use client";

import { useState } from "react";
import { repo, useLayaway } from "@/lib/hooks";
import { money, moneyWhole, parseCents } from "@/lib/pricing";
import { addDays, isoDate, shortDate } from "@/lib/time";
import { AField, Btn, Card, Empty, QueryView, useRun } from "../kit";
import s from "../admin.module.css";

export function LayawayPage() {
  const q = useLayaway();
  const { run, busy } = useRun();
  const plans = q.data ?? [];
  const owed = plans.reduce((a, l) => a + (l.totalCents - l.paidCents), 0);
  return (
    <>
      <Card title="Layaway plans">
        <p className={s.note} style={{ margin: "0 0 8px" }}>
          {plans.length} plan{plans.length === 1 ? "" : "s"}, {moneyWhole(owed)} still owed. Each payment goes into the books with its HST.
        </p>
        <QueryView q={q} isEmpty={(d) => d.length === 0} empty={<Empty title="No layaway plans" text="Start one below when a customer wants to pay a piece off over time." />}>
          {(list) => (
            <div>
              {list.map((l) => {
                const done = l.paidCents >= l.totalCents;
                const pct = Math.min(100, Math.round((l.paidCents / Math.max(1, l.totalCents)) * 100));
                const nextAmt = Math.min(l.instalmentCents, l.totalCents - l.paidCents);
                return (
                  <div className={s.lay} key={l.id}>
                    <div>
                      <b style={{ fontWeight: 500 }}>{l.customer}</b>
                      <small style={{ display: "block", color: "var(--muted)" }}>{l.itemLabel}</small>
                    </div>
                    <div>
                      <div className={s.prog} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${l.customer} paid ${pct} percent`}>
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <small style={{ color: "var(--muted)" }}>
                        {money(l.paidCents)} paid of {money(l.totalCents)} · balance {money(l.totalCents - l.paidCents)} · {done ? "paid in full" : `next ${shortDate(l.nextDue)}`}
                      </small>
                    </div>
                    <Btn small variant="line" disabled={done || busy} onClick={() => run(() => repo().layaway.recordPayment(l.id), `Payment of ${money(nextAmt)} recorded for ${l.customer} and added to the books.`)} aria-label={done ? `${l.customer} paid in full` : `Record ${money(nextAmt)} for ${l.customer}`}>
                      {done ? "Paid in full" : `Record ${money(nextAmt)}`}
                    </Btn>
                  </div>
                );
              })}
            </div>
          )}
        </QueryView>
      </Card>
      <NewPlan />
    </>
  );
}

function NewPlan() {
  const { run, busy } = useRun();
  const [customer, setCustomer] = useState("");
  const [item, setItem] = useState("");
  const [total, setTotal] = useState("");
  const [dep, setDep] = useState("");
  const [per, setPer] = useState("");
  const [due, setDue] = useState(addDays(isoDate(new Date()), 14));
  const [touched, setTouched] = useState(false);
  const totalC = parseCents(total);
  const depC = dep.trim() === "" ? 0 : parseCents(dep);
  const perC = parseCents(per);
  const errs = {
    customer: customer.trim().length < 2 ? "Enter the customer's name." : null,
    item: item.trim().length < 2 ? "Describe the piece." : null,
    total: totalC === null || totalC <= 0 ? "Enter the total, HST included." : null,
    dep: depC === null ? "Enter a number." : totalC !== null && depC > totalC ? "More than the total." : null,
    per: perC === null || perC <= 0 ? "Enter the instalment." : null,
  };
  async function add() {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const p = await run(() => repo().layaway.add({ customer, itemLabel: item, totalCents: totalC as number, depositCents: depC as number, instalmentCents: perC as number, nextDue: due }), (x) => `Plan started for ${x.customer}.`);
    if (p) {
      setCustomer("");
      setItem("");
      setTotal("");
      setDep("");
      setPer("");
      setTouched(false);
    }
  }
  return (
    <Card title="Start a plan">
      <form
        className={s.stack}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div className={s.ex}>
          <AField label="Customer" error={touched ? errs.customer : null}>{(p) => <input {...p} value={customer} onChange={(e) => setCustomer(e.target.value)} />}</AField>
          <AField label="Piece" error={touched ? errs.item : null}>{(p) => <input {...p} value={item} onChange={(e) => setItem(e.target.value)} placeholder="Bridal set GM-1005" />}</AField>
          <AField label="Total, HST included ($)" error={touched ? errs.total : null}>{(p) => <input {...p} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />}</AField>
        </div>
        <div className={s.ex}>
          <AField label="Deposit today ($)" error={touched ? errs.dep : null}>{(p) => <input {...p} inputMode="decimal" value={dep} onChange={(e) => setDep(e.target.value)} placeholder="0" />}</AField>
          <AField label="Instalment ($)" error={touched ? errs.per : null}>{(p) => <input {...p} inputMode="decimal" value={per} onChange={(e) => setPer(e.target.value)} />}</AField>
          <AField label="First instalment due">{(p) => <input {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</AField>
        </div>
        <div>
          <Btn type="submit" disabled={busy}>
            Start plan
          </Btn>
        </div>
      </form>
    </Card>
  );
}
