"use client";

import { useEffect, useState } from "react";
import { DomainError } from "@/lib/domain/errors";
import type { Karat } from "@/lib/domain/schemas";
import { CATEGORIES } from "@/lib/domain/schemas";
import { repo, useRate, useRateHistory, useSession, useSettings } from "@/lib/hooks";
import type { RateFeedSuggestion } from "@/lib/repo/types";
import { allRates, money, parseCents } from "@/lib/pricing";
import { shortDate, whenLabel } from "@/lib/time";
import { AField, Btn, Card, SwitchRow, useRun } from "../kit";
import s from "../admin.module.css";

export function RatePage() {
  const owner = useSession()?.role === "owner";
  const { data: current } = useRate();
  const { data: settings } = useSettings();
  const hist = useRateHistory(7).data ?? [];
  const { run, busy } = useRun();
  const [draft, setDraft] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [bigOk, setBigOk] = useState(false);
  const [sug, setSug] = useState<RateFeedSuggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const base = current?.rate24Cents ?? 20800;
  const value = draft ?? base;
  const shown = allRates(value);
  const changed = draft !== null && draft !== base;
  const movePct = base > 0 ? Math.abs(value - base) / base : 0;
  const big = movePct > 0.1;

  useEffect(() => {
    if (draft === null) setText((base / 100).toFixed(2));
  }, [base, draft]);

  useEffect(() => {
    if (!owner || !settings?.morningSuggestion || !current) return;
    let alive = true;
    repo().ports.rateFeed.suggest(current.rate24Cents).then((x) => alive && setSug(x), () => {});
    return () => {
      alive = false;
    };
  }, [owner, settings?.morningSuggestion, current]);

  const set = (cents: number) => {
    const c = Math.max(5000, Math.min(100000, cents));
    setDraft(c);
    setText((c / 100).toFixed(2));
    setBigOk(false);
  };

  async function publish() {
    if (!owner) return;
    if (big && !bigOk) {
      setBigOk(true);
      return;
    }
    const r = await run(() => repo().rates.publish(value), "New rate published. Every price on the shop now uses it.");
    if (r) {
      setDraft(null);
      setBigOk(false);
    }
  }

  const lo = Math.min(...hist.map((h) => h.rate24Cents), base);
  const hi = Math.max(...hist.map((h) => h.rate24Cents), base);
  const settingsOff = !owner;
  const upd = (patch: Parameters<ReturnType<typeof repo>["settings"]["update"]>[0], ok = "Saved.") => run(() => repo().settings.update(patch), ok);

  return (
    <div className={s.g2}>
      <div className={s.stack}>
        <div className={s.bigrate}>
          <small>24 karat per gram</small>
          <div className={s.stepper} role="group" aria-label="24 karat rate per gram">
            <button type="button" onClick={() => set(value - 100)} disabled={!owner} aria-label="Lower rate by one dollar">
              &minus;
            </button>
            <input
              aria-label="24 karat rate in dollars"
              inputMode="decimal"
              value={`$${text.replace("$", "")}`}
              disabled={!owner}
              onChange={(e) => setText(e.target.value.replace("$", ""))}
              onBlur={() => {
                const c = parseCents(text);
                if (c !== null) set(c);
                else setText((value / 100).toFixed(2));
              }}
            />
            <button type="button" onClick={() => set(value + 100)} disabled={!owner} aria-label="Raise rate by one dollar">
              +
            </button>
          </div>
          <div className={s.rg}>
            {([22, 18, 14] as Karat[]).map((k) => (
              <div key={k}>
                <small>{k}k</small>
                <div className={s.v}>{money(shown[k])}</div>
              </div>
            ))}
          </div>
          {big ? (
            <p role="alert" style={{ margin: 0, color: "#ffd9a8", fontSize: 13 }}>
              That is a {Math.round(movePct * 100)}% move from the current rate. {bigOk ? "Press Publish again to confirm." : "Check the number before you publish."}
            </p>
          ) : null}
          <div>
            <Btn variant="gold" onClick={publish} disabled={!owner || busy || (!changed && !!current)}>
              {big && bigOk ? "Yes, publish this rate" : "Publish to website"}
            </Btn>
            <span className={s.stamp} aria-live="polite">
              {changed ? "Changed, not yet published" : current ? `Last published ${whenLabel(current.publishedAt)} by ${current.publishedBy}` : "Loading"}
            </span>
          </div>
          {!owner ? <p style={{ margin: 0, color: "#b9ad94", fontSize: 13 }}>Only the owner can change the rate. You can see it here.</p> : null}
        </div>
        {owner && settings?.morningSuggestion && sug && !dismissed ? (
          <Card title="Morning suggestion">
            <p style={{ margin: "0 0 12px" }}>
              <b style={{ fontWeight: 500 }}>{money(sug.rate24Cents)}</b> per gram for 24k. <span style={{ color: "var(--muted)" }}>{sug.source}. Nothing is published until you say so.</span>
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn small onClick={() => set(sug.rate24Cents)}>
                Use this rate
              </Btn>
              <Btn small variant="line" onClick={() => setDismissed(true)}>
                Ignore
              </Btn>
            </div>
          </Card>
        ) : null}
        <Card title="Last 7 days, 24k">
          {hist.length === 0 ? (
            <p className={s.note}>No history yet.</p>
          ) : (
            <div className={s.bars} role="img" aria-label={`24k rate for the last ${hist.length} mornings, from ${money(lo)} to ${money(hi)}`}>
              {hist.map((h, i) => (
                <div className={s.barCol} key={h.id}>
                  <i className={`${s.bar} ${i === hist.length - 1 ? s.barHl : ""}`} style={{ height: `${hi === lo ? 60 : 12 + Math.round(((h.rate24Cents - lo) / (hi - lo)) * 88)}%` }} />
                  <span>{i === hist.length - 1 ? "Today" : shortDate(h.publishedAt.slice(0, 10))}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className={s.stack}>
        <Card title="How prices work">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Every piece is priced as weight x rate for its karat, plus its making charge, plus any stone. Change the rate once and every online price updates. Reserved pieces keep the rate they were reserved at for the hold time.
          </p>
        </Card>
        <Card title="Rate settings">
          <SwitchRow title="Pull the market rate each morning" sub="Suggest a new 24k rate to approve. It never publishes by itself" on={!!settings?.morningSuggestion} disabled={settingsOff} onChange={(v) => upd({ morningSuggestion: v })} />
          <SwitchRow title='Show "updated at" on the website' sub="Customers see when the rate was last set" on={settings?.showUpdatedAt !== false} disabled={settingsOff} onChange={(v) => upd({ showUpdatedAt: v })} />
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <PercentField key={`buy-${settings?.buyRatePct}`} label="Buy rate for old gold (% of rate)" value={settings?.buyRatePct ?? 94} min={50} max={100} disabled={settingsOff} onCommit={(n) => upd({ buyRatePct: n })} />
            <PercentField key={`bar-${settings?.barPremiumPct}`} label="Gold bar premium (%)" value={settings?.barPremiumPct ?? 2} min={0} max={20} disabled={settingsOff} onCommit={(n) => upd({ barPremiumPct: n })} />
          </div>
        </Card>
        <Card title="Default making charge">
          <p className={s.note} style={{ margin: "0 0 8px" }}>Used to fill in new pieces. Each piece can still have its own.</p>
          {CATEGORIES.filter((c) => c !== "Bars").map((c) => (
            <div className={s.row} key={c}>
              <div className={s.gr}>
                <b>{c}</b>
              </div>
              <div style={{ width: 120 }}>
                <PercentField key={`${c}-${settings?.defaultMakingBps[c]}`} label={`${c} making %`} hideLabel value={(settings?.defaultMakingBps[c] ?? 0) / 100} min={0} max={100} disabled={settingsOff} onCommit={(n) => upd({ defaultMakingBps: { ...(settings as NonNullable<typeof settings>).defaultMakingBps, [c]: Math.round(n * 100) } })} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function PercentField({ label, value, min, max, onCommit, disabled, hideLabel }: { label: string; value: number; min: number; max: number; onCommit: (n: number) => unknown; disabled?: boolean; hideLabel?: boolean }) {
  const [t, setT] = useState(String(value));
  const [err, setErr] = useState<string | null>(null);
  return (
    <AField label={label} error={err}>
      {(p) => (
        <input
          {...p}
          aria-label={hideLabel ? label : undefined}
          inputMode="decimal"
          value={t}
          disabled={disabled}
          onChange={(e) => setT(e.target.value)}
          onBlur={() => {
            const n = Number(t.replace(/[^0-9.]/g, ""));
            if (!Number.isFinite(n) || t.trim() === "" || n < min || n > max) {
              setErr(`Enter a number from ${min} to ${max}.`);
              return;
            }
            setErr(null);
            if (n !== value) void Promise.resolve(onCommit(n)).catch((e) => e instanceof DomainError && setErr(e.message));
          }}
        />
      )}
    </AField>
  );
}
