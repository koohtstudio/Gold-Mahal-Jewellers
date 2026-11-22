"use client";

import { useEffect, useState } from "react";
import { Dialog, Pill } from "@/components/ui";
import type { Reservation, ReservationStatus } from "@/lib/domain/schemas";
import { formatPhone } from "@/lib/guards";
import { repo, useReservations, useValuations, useVisits } from "@/lib/hooks";
import { grams, money, moneyWhole, rateFor } from "@/lib/pricing";
import { dayLabel, isoDate, shortDate, timeLabel } from "@/lib/time";
import { Btn, Card, Empty, QueryView, Table, Tabs, useRun } from "../kit";
import s from "../admin.module.css";

type Section = "reservations" | "visits" | "valuations";
type Filter = "all" | "new" | "ready" | "sold" | "closed";

const LABEL: Record<ReservationStatus, string> = { new: "New", ready: "Ready", sold: "Sold", released: "Released", expired: "Expired" };
const TONE = { new: "new", ready: "ready", sold: "sold", released: "out", expired: "out" } as const;
const held = (iso: string) => `${dayLabel(isoDate(new Date(iso)))} at ${timeLabel(new Date(iso))}`;

export function ReservationsPage() {
  const [section, setSection] = useState<Section>("reservations");
  const visits = useVisits().data ?? [];
  const vals = useValuations().data ?? [];
  const res = useReservations().data ?? [];
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "visits" || t === "valuations") setSection(t);
  }, []);
  return (
    <>
      <Tabs
        label="Reservations, visit requests and valuations"
        value={section}
        onChange={(k) => {
          setSection(k);
          const u = new URL(window.location.href);
          u.searchParams.set("tab", k);
          window.history.replaceState(null, "", u);
        }}
        tabs={[
          { key: "reservations", label: "Reservations", count: res.filter((r) => r.status === "new" || r.status === "ready").length },
          { key: "visits", label: "Visit requests", count: visits.filter((v) => v.status === "new").length },
          { key: "valuations", label: "Valuations", count: vals.filter((v) => v.status === "new").length },
        ]}
      />
      {section === "reservations" ? <ReservationList /> : section === "visits" ? <VisitList /> : <ValuationList />}
    </>
  );
}

function ReservationList() {
  const q = useReservations();
  const [filter, setFilter] = useState<Filter>("all");
  const [selId, setSelId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setSelId(id);
  }, []);
  const all = q.data ?? [];
  const match = (r: Reservation, f: Filter) => f === "all" || (f === "closed" ? r.status === "released" || r.status === "expired" : r.status === f);
  const rows = all.filter((r) => match(r, filter));
  const sel = rows.find((r) => r.id === selId) ?? rows[0] ?? null;
  const n = (f: Filter) => all.filter((r) => match(r, f)).length;
  return (
    <>
      <Tabs
        label="Filter reservations"
        value={filter}
        onChange={setFilter}
        tabs={[
          { key: "all", label: "All", count: n("all") },
          { key: "new", label: "New", count: n("new") },
          { key: "ready", label: "Ready", count: n("ready") },
          { key: "sold", label: "Sold", count: n("sold") },
          { key: "closed", label: "Released and expired", count: n("closed") },
        ]}
      />
      <QueryView q={q} isEmpty={(d) => d.length === 0} empty={<Card><Empty title="No reservations yet" text="When a customer reserves a piece on the website it shows up here within a second." /></Card>}>
        {() =>
          rows.length === 0 ? (
            <Card>
              <Empty title="Nothing in this tab" text="Try another filter." />
            </Card>
          ) : (
            <div className={s.g3}>
              <ul className={s.lst} aria-label="Reservations" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {rows.map((r) => (
                  <li key={r.id} style={{ display: "contents" }}>
                    <button type="button" className={`${s.li} ${sel?.id === r.id ? s.liOn : ""}`} aria-current={sel?.id === r.id ? "true" : undefined} onClick={() => setSelId(r.id)}>
                      <div className={s.gr}>
                        <b>
                          {r.id} · {r.customer}
                        </b>
                        <small>
                          {r.lines.map((l) => l.name).join(", ")} · {moneyWhole(r.totalCents)}
                        </small>
                      </div>
                      <Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill>
                    </button>
                  </li>
                ))}
              </ul>
              {sel ? <Detail r={sel} /> : null}
            </div>
          )
        }
      </QueryView>
    </>
  );
}

function Detail({ r }: { r: Reservation }) {
  const { run, busy } = useRun();
  const [confirm, setConfirm] = useState(false);
  const open = r.status === "new" || r.status === "ready";
  return (
    <section className={`${s.card} ${s.dt}`} aria-label={`Reservation ${r.id}`}>
      <h2>{r.id}</h2>
      <Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill>
      <div className={s.msg}>
        {r.lines.map((l) => `${l.name} (${l.option}${l.qty > 1 ? `, x${l.qty}` : ""})`).join(", ")}
      </div>
      <dl className={s.kv}>
        <dt>Customer</dt>
        <dd>{r.customer}</dd>
        <dt>Mobile</dt>
        <dd>{formatPhone(r.phone)}</dd>
        <dt>Visit</dt>
        <dd>{r.visitLabel}</dd>
        <dt>Held until</dt>
        <dd>{open ? held(r.holdUntil) : "Hold ended"}</dd>
        <dt>Locked rate</dt>
        <dd>
          {money(rateFor(r.lockedRate24Cents, 22))} per gram (22k), {money(r.lockedRate24Cents)} (24k)
        </dd>
        <dt>Subtotal</dt>
        <dd>{money(r.subtotalCents)}</dd>
        <dt>HST</dt>
        <dd>{money(r.hstCents)}</dd>
        <dt>Total</dt>
        <dd>{money(r.totalCents)}</dd>
        <dt>Code</dt>
        <dd>{r.code}</dd>
      </dl>
      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        <Btn disabled={busy || r.status !== "new"} onClick={() => run(() => repo().reservations.markReady(r.id), `Text logged for ${r.customer} with code ${r.code} (preview, nothing was sent).`)}>
          Ready, text customer
        </Btn>
        <Btn variant="line" disabled={busy || !open} onClick={() => run(() => repo().reservations.markSold(r.id), `${r.id} marked sold and added to the sales ledger.`)}>
          Mark sold
        </Btn>
        <Btn variant="line" disabled={busy || !open} onClick={() => setConfirm(true)}>
          Release hold
        </Btn>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} label="Release hold">
        <div className={s.sheetBody} style={{ width: "min(100vw, 460px)", gap: 14 }}>
          <h2 style={{ font: "500 26px var(--font-display)", margin: 0 }}>Release this hold?</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>The pieces go back in the case and the customer is not charged. This does not create a sale.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn
              disabled={busy}
              onClick={async () => {
                const ok = await run(() => repo().reservations.release(r.id), "Hold released. The pieces are back in the case.");
                if (ok) setConfirm(false);
              }}
            >
              Yes, release
            </Btn>
            <Btn variant="line" onClick={() => setConfirm(false)}>
              Keep it
            </Btn>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

function VisitList() {
  const q = useVisits();
  const { run, busy } = useRun();
  return (
    <Card>
      <QueryView q={q} isEmpty={(d) => d.length === 0} empty={<Empty title="No visit requests" text="Requests from the Book a visit form on the website land here." />}>
        {(rows) => (
          <Table label="Visit requests">
            <thead>
              <tr>
                <th>Received</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Reason</th>
                <th>Preferred day</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>{shortDate(isoDate(new Date(v.createdAt)))}</td>
                  <td>{v.name}</td>
                  <td>{formatPhone(v.phone)}</td>
                  <td>{v.type}</td>
                  <td>{dayLabel(v.preferredDate)}</td>
                  <td>
                    <Pill tone={v.status === "new" ? "new" : v.status === "called" ? "gold" : "ok"}>{v.status === "new" ? "New" : v.status === "called" ? "Called" : "Done"}</Pill>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small variant="line" disabled={busy || v.status !== "new"} onClick={() => run(() => repo().visits.setVisitStatus(v.id, "called"), "Marked as called.")}>
                        Called
                      </Btn>
                      <Btn small variant="line" disabled={busy || v.status === "done"} onClick={() => run(() => repo().visits.setVisitStatus(v.id, "done"), "Marked done.")}>
                        Done
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryView>
    </Card>
  );
}

function ValuationList() {
  const q = useValuations();
  const { run, busy } = useRun();
  return (
    <Card>
      <QueryView q={q} isEmpty={(d) => d.length === 0} empty={<Empty title="No valuation requests" text="Requests from Book a valuation on the old gold estimator land here." />}>
        {(rows) => (
          <Table label="Valuation requests">
            <thead>
              <tr>
                <th>Received</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Karat</th>
                <th className={s.r}>Grams</th>
                <th className={s.r}>Estimate</th>
                <th>Preferred day</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>{shortDate(isoDate(new Date(v.createdAt)))}</td>
                  <td>{v.name}</td>
                  <td>{formatPhone(v.phone)}</td>
                  <td>{v.karat}k</td>
                  <td className={s.r}>{grams(v.gramsMilli)}</td>
                  <td className={s.r}>{money(v.estimateCents)}</td>
                  <td>{dayLabel(v.preferredDate)}</td>
                  <td>
                    <Pill tone={v.status === "new" ? "new" : v.status === "called" ? "gold" : "ok"}>{v.status === "new" ? "New" : v.status === "called" ? "Called" : "Done"}</Pill>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small variant="line" disabled={busy || v.status !== "new"} onClick={() => run(() => repo().visits.setValuationStatus(v.id, "called"), "Marked as called.")}>
                        Called
                      </Btn>
                      <Btn small variant="line" disabled={busy || v.status === "done"} onClick={() => run(() => repo().visits.setValuationStatus(v.id, "done"), "Marked done.")}>
                        Done
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </QueryView>
    </Card>
  );
}
