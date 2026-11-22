"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui";
import { config } from "@/lib/config";
import type { DayKey, Settings } from "@/lib/domain/schemas";
import { repo, useAudit, useSent, useSettings } from "@/lib/hooks";
import { clock, whenLabel } from "@/lib/time";
import { AField, Btn, Card, Empty, OwnerOnly, QueryView, SwitchRow, Table, useRun } from "../kit";
import { PercentField } from "./RatePage";
import s from "../admin.module.css";

const DAY_NAME: Record<DayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const toHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const fromHM = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function SettingsPage() {
  return (
    <OwnerOnly what="Settings">
      <SettingsInner />
    </OwnerOnly>
  );
}

function SettingsInner() {
  const q = useSettings();
  const { run } = useRun();
  const st = q.data;
  const sentQ = useSent();
  const auditQ = useAudit();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const save = (patch: Partial<Settings>, ok = "Saved.") => run(() => repo().settings.update(patch), ok);
  if (!st) return <Card>{q.error ? <Empty title="Settings did not load" text={q.error} /> : <p className={s.note}>Loading</p>}</Card>;

  const setHours = (d: DayKey, v: { open: number; close: number } | null) => save({ hours: { ...st.hours, [d]: v } }, "Hours saved.");

  return (
    <>
      <div className={s.g2}>
        <div className={s.stack}>
          <Card title="Reservations and visits">
            <div className={s.ex2 + " " + s.ex}>
              <PercentField key={`hold-${st.holdHours}`} label="Hold time (hours)" value={st.holdHours} min={1} max={336} onCommit={(n) => save({ holdHours: Math.round(n) })} />
              <PercentField key={`cap-${st.slotCapacity}`} label="Visits per time window" value={st.slotCapacity} min={1} max={20} onCommit={(n) => save({ slotCapacity: Math.round(n) })} />
            </div>
            <p className={s.note}>A hold lasts this long from the reservation, or until the end of the customer&apos;s visit day if that is later.</p>
            <h3 style={{ font: "500 20px var(--font-display)", margin: "18px 0 8px" }}>Hours</h3>
            <div role="group" aria-label="Opening hours" style={{ display: "grid", gap: 8 }}>
              {ORDER.map((d) => {
                const h = st.hours[d];
                return (
                  <div key={d} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                    <span style={{ alignSelf: "center" }}>{DAY_NAME[d]}</span>
                    <AField label={`${DAY_NAME[d]} opens`}>
                      {(p) => <input {...p} type="time" disabled={!h} value={h ? toHM(h.open) : ""} onChange={(e) => e.target.value && h && setHours(d, { ...h, open: fromHM(e.target.value) })} />}
                    </AField>
                    <AField label={`${DAY_NAME[d]} closes`}>
                      {(p) => <input {...p} type="time" disabled={!h} value={h ? toHM(h.close) : ""} onChange={(e) => e.target.value && h && setHours(d, { ...h, close: fromHM(e.target.value) })} />}
                    </AField>
                    <Btn small variant="line" onClick={() => setHours(d, h ? null : { open: 11 * 60, close: 19 * 60 })} aria-label={h ? `Close on ${DAY_NAME[d]}` : `Open on ${DAY_NAME[d]}`}>
                      {h ? "Close" : "Open"}
                    </Btn>
                  </div>
                );
              })}
            </div>
            <p className={s.note}>
              Today the hours read {clock(st.hours.tue?.open ?? 0)} to {clock(st.hours.tue?.close ?? 0)} on Tuesdays. Customers see these hours and pick visit times inside them.
            </p>
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <AField label="Ready text">{(p) => <input {...p} key={st.readyText} defaultValue={st.readyText} onBlur={(e) => e.target.value !== st.readyText && save({ readyText: e.target.value })} />}</AField>
              <AField label="Expiry text" hint="Sent a day before a hold ends. Use {item} for the piece name.">
                {(p) => <input {...p} key={st.expiryText} defaultValue={st.expiryText} onBlur={(e) => e.target.value !== st.expiryText && save({ expiryText: e.target.value })} />}
              </AField>
            </div>
          </Card>
          <Card title="Sent messages">
            <QueryView q={sentQ} isEmpty={(d) => d.length === 0} empty={<Empty title="Nothing sent yet" text="Texts and emails that would go out show here. In this preview nothing is actually sent." />}>
              {(rows) => (
                <Table label="Sent messages">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>To</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 40).map((m) => (
                      <tr key={m.id}>
                        <td>{whenLabel(m.at)}</td>
                        <td>{m.channel === "sms" ? "Text" : "Email"}</td>
                        <td>{m.to}</td>
                        <td>{m.subject ? `${m.subject}: ` : ""}{m.body}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </QueryView>
          </Card>
        </div>
        <div className={s.stack}>
          <Card title="Shop rules">
            <SwitchRow title="Accept online reservations" sub="Turn off to pause the shop" on={st.acceptOrders} onChange={(v) => save({ acceptOrders: v })} />
            <SwitchRow title="Lock the rate at reservation" sub="Customer keeps the rate for the hold time" on={st.lockRate} onChange={(v) => save({ lockRate: v })} />
            <SwitchRow title="Text me on new reservations" sub="Logged to the store number (905) 913-1212" on={st.textOnNew} onChange={(v) => save({ textOnNew: v })} />
            <SwitchRow title="Allow same-day visits" sub="Off needs a day of notice" on={st.sameDay} onChange={(v) => save({ sameDay: v })} />
            <SwitchRow title="Show gold rate on the website" sub="Ticker and calculator" on={st.showRateOnSite} onChange={(v) => save({ showRateOnSite: v })} />
          </Card>
          <Card title="Demo data">
            <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
              Mode: <b style={{ fontWeight: 500 }}>{config.mode === "demo" ? "demo, shared across devices" : config.mode === "live" ? "live" : "mock, saved in this browser"}</b>. Reset puts back the sample pieces, reservations, jobs and books.
            </p>
            <Btn variant="line" onClick={() => setResetOpen(true)}>
              Reset demo data
            </Btn>
          </Card>
          <Card title="Audit log">
            <QueryView q={auditQ} isEmpty={(d) => d.length === 0} empty={<Empty title="Nothing logged yet" />}>
              {(rows) => (
                <Table label="Audit log">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>What</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 40).map((a) => (
                      <tr key={a.id}>
                        <td>{whenLabel(a.at)}</td>
                        <td>{a.actor}</td>
                        <td>
                          {a.action} {a.target}
                          {a.meta ? ` (${a.meta})` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </QueryView>
            <p className={s.note}>Rate changes, sales, old gold ID views, exports and accountant sends are all recorded here.</p>
          </Card>
        </div>
      </div>
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} label="Reset demo data">
        <div className={s.sheetBody} style={{ width: "min(100vw, 480px)", gap: 16 }}>
          <h2 style={{ font: "500 28px var(--font-display)", margin: 0 }}>Reset demo data?</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>This puts back the sample data. Anything you added or changed is removed.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn
              disabled={resetting}
              onClick={async () => {
                setResetting(true);
                await run(() => repo().reset(), "Demo data reset.");
                setResetting(false);
                setResetOpen(false);
              }}
            >
              {resetting ? "Resetting" : "Yes, reset"}
            </Btn>
            <Btn variant="line" onClick={() => setResetOpen(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      </Dialog>
    </>
  );
}

