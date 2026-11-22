"use client";

import Link from "next/link";
import { useMemo } from "react";
import { KARATS } from "@/lib/domain/constants";
import { buildBooks, salesByDay } from "@/lib/books/summary";
import { useAllPieces, useExpenses, useJobs, useLayaway, useLedger, useRate, useReservations, useSession, useValuations, useVisits } from "@/lib/hooks";
import { usePricing } from "@/lib/hooks/pricing";
import { divHE, grams, money, moneyWhole } from "@/lib/pricing";
import { addDays, dayLabel, isoDate, periodsFor, shortDate, timeLabel, whenLabel } from "@/lib/time";
import { Btn, Card, Empty, Kpi, Table } from "../kit";
import s from "../admin.module.css";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Dashboard() {
  const owner = useSession()?.role === "owner";
  const now = useMemo(() => new Date(), []);
  const today = isoDate(now);
  const month = useMemo(() => periodsFor(now)[0]!, [now]);
  const res = useReservations().data ?? [];
  const jobs = useJobs().data ?? [];
  const lay = useLayaway().data ?? [];
  const pieces = useAllPieces().data ?? [];
  const visits = useVisits().data ?? [];
  const vals = useValuations().data ?? [];
  const rate = useRate().data;
  const { rates } = usePricing();
  const ledger14 = useLedger({ from: addDays(today, -13), to: today }).data ?? [];
  const monthLedger = useLedger(month).data ?? [];
  const monthExp = useExpenses(month).data ?? [];

  const toPrepare = res.filter((r) => r.status === "new").length;
  const ready = res.filter((r) => r.status === "ready").length;
  const openJobs = jobs.filter((j) => j.stage !== "ready" && !j.closedAt).length;
  const layBalance = lay.reduce((a, l) => a + (l.totalCents - l.paidCents), 0);

  const days = salesByDay(ledger14, today, 14, addDays);
  const thisWeek = days.slice(7).reduce((a, d) => a + d.totalCents, 0);
  const lastWeek = days.slice(0, 7).reduce((a, d) => a + d.totalCents, 0);
  const pct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
  const bars = days.slice(7);
  const maxBar = Math.max(1, ...bars.map((b) => b.totalCents));
  const topDay = bars.reduce((a, b) => (b.totalCents > a.totalCents ? b : a), bars[0] ?? { date: "", totalCents: 0 });

  const books = buildBooks({ from: month.from, to: month.to, label: month.label }, { ledger: monthLedger, expenses: monthExp, oldGold: [] });

  const attention: Array<{ key: string; t: string; sub: string; href: string }> = [];
  if (owner && rate && isoDate(new Date(rate.publishedAt)) < today) attention.push({ key: "rate", t: "Publish today's gold rate", sub: `Last published ${whenLabel(rate.publishedAt, now)}`, href: "/admin/rate" });
  for (const r of res.filter((x) => (x.status === "new" || x.status === "ready") && new Date(x.holdUntil).getTime() - now.getTime() < 24 * 3600_000)) {
    const when = isoDate(new Date(r.holdUntil)) === today ? "today" : "tomorrow";
    attention.push({ key: r.id, t: `Reservation ${r.id} ends ${when}`, sub: `${r.customer} · ${r.lines[0]?.name ?? ""}`, href: `/admin/reservations?id=${r.id}` });
  }
  for (const j of jobs.filter((x) => x.stage === "ready" && !x.closedAt)) attention.push({ key: j.id, t: `Job ${j.ticket} is ready`, sub: `${j.customer} · ${j.phone ? "text sent" : "call to pick up"}`, href: "/admin/jobs" });
  for (const l of lay.filter((x) => x.nextDue && x.nextDue <= addDays(today, 7))) attention.push({ key: l.id, t: `Layaway due ${shortDate(l.nextDue)}`, sub: `${l.customer} · ${money(Math.min(l.instalmentCents, l.totalCents - l.paidCents))}`, href: "/admin/layaway" });
  for (const v of vals.filter((x) => x.status === "new")) attention.push({ key: v.id, t: "Valuation request from the website", sub: `${v.name} · old gold, ${dayLabel(v.preferredDate)}`, href: "/admin/reservations?tab=valuations" });
  for (const v of visits.filter((x) => x.status === "new")) attention.push({ key: v.id, t: "Visit request from the website", sub: `${v.name} · ${v.type.toLowerCase()}, ${dayLabel(v.preferredDate)}`, href: "/admin/reservations?tab=visits" });

  const stock = KARATS.map((k) => {
    const g = pieces.filter((p) => p.karat === k).reduce((a, p) => a + p.netGramsMilli * Math.max(0, p.units - p.unitsSold), 0);
    const value = divHE(g * rates[k], 1000);
    return { k, g, value, cost: divHE(value * 97, 100) };
  }).filter((x) => x.g > 0);

  return (
    <>
      <div className={s.kpis}>
        <Kpi label="Reservations to prepare" value={toPrepare} sub={`held for pickup${ready ? `, ${ready} ready` : ""}`} />
        <Kpi label="Open jobs" value={openJobs} sub="custom and repairs" />
        <Kpi label="Layaway balance" value={moneyWhole(layBalance)} sub="owed by customers" />
        {owner ? <Kpi label="Sales this week" value={moneyWhole(thisWeek)} sub={pct === null ? "last week had no sales" : pct >= 0 ? `up ${pct}% on last week` : `down ${Math.abs(pct)}% on last week`} /> : <Kpi label="Ready for pickup" value={ready} sub="waiting at the counter" />}
      </div>
      <div className={s.g2}>
        {owner ? (
          <Card title="Sales by day">
            {thisWeek === 0 ? (
              <Empty title="No sales in the last 7 days" text="Sales appear here when a reservation is marked sold or a counter sale is recorded." />
            ) : (
              <div className={s.bars} role="img" aria-label={`Sales for the last 7 days. Best day ${DAY[new Date(`${topDay.date}T12:00:00Z`).getUTCDay()]} at ${moneyWhole(topDay.totalCents)}`}>
                {bars.map((b) => (
                  <div className={s.barCol} key={b.date}>
                    <i className={`${s.bar} ${b.date === topDay.date ? s.barHl : ""}`} style={{ height: `${Math.max(3, Math.round((b.totalCents / maxBar) * 100))}%` }} />
                    <span>{DAY[new Date(`${b.date}T12:00:00Z`).getUTCDay()]}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : null}
        <Card title="Needs you today">
          {attention.length === 0 ? (
            <Empty title="All caught up" text="Nothing is waiting on you right now." />
          ) : (
            attention.slice(0, 7).map((a) => (
              <div className={s.row} key={a.key}>
                <div className={s.gr}>
                  <b>{a.t}</b>
                  <small>{a.sub}</small>
                </div>
                <Link href={a.href} className={`${s.btn} ${s.btnLine} ${s.btnSm}`}>
                  Open
                </Link>
              </div>
            ))
          )}
        </Card>
      </div>
      <div className={s.g2}>
        <Card title="Gold on hand">
          {stock.length === 0 ? (
            <Empty title="No gold in stock" text="Add pieces in Inventory to see grams and value here." />
          ) : (
            <>
              <Table label="Gold on hand by karat">
                <thead>
                  <tr>
                    <th>Karat</th>
                    <th className={s.r}>Grams</th>
                    <th className={s.r}>At cost (estimate)</th>
                    <th className={s.r}>At today&apos;s rate</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((x) => (
                    <tr key={x.k}>
                      <td>{x.k}k</td>
                      <td className={s.r}>{grams(x.g)}</td>
                      <td className={s.r}>{money(x.cost)}</td>
                      <td className={s.r}>{money(x.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className={s.note}>Net weight of pieces in the case and on hold. Cost is estimated at 97% of today&apos;s rate until purchase costs are entered.</p>
            </>
          )}
        </Card>
        {owner ? (
          <div className={`${s.kpi} ${s.kpiHl}`} style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
            <small>Books · {month.label}</small>
            <b style={{ fontSize: 30 }}>
              {moneyWhole(books.salesTotalCents)} in sales, {money(books.hstToRemitCents)} HST to remit
            </b>
            <span>Everything your accountant needs is ready.</span>
            <div>
              <Link href="/admin/books" className={`${s.btn} ${s.btnGold}`}>
                Open books
              </Link>
            </div>
          </div>
        ) : (
          <Card title="Quick links">
            <div style={{ display: "grid", gap: 8 }}>
              <Link href="/admin/reservations" className={`${s.btn} ${s.btnLine}`}>
                Reservations
              </Link>
              <Link href="/admin/old-gold" className={`${s.btn} ${s.btnLine}`}>
                Record an old gold purchase
              </Link>
              <Link href="/admin/layaway" className={`${s.btn} ${s.btnLine}`}>
                Record a layaway payment
              </Link>
            </div>
          </Card>
        )}
      </div>
      <p className={s.note} style={{ margin: 0 }}>
        Updated {timeLabel(now)}. <Btn variant="line" small onClick={() => window.location.reload()}>Refresh</Btn>
      </p>
    </>
  );
}
