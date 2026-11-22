"use client";

import { useCallback, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Skeleton, useToast } from "@/components/ui";
import { messageOf } from "@/lib/domain/errors";
import { useSession, type Query } from "@/lib/hooks";
import s from "./admin.module.css";

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");

export function Btn({ variant = "ink", small, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ink" | "gold" | "line"; small?: boolean }) {
  return <button type="button" {...rest} className={cx(s.btn, variant === "ink" ? s.btnInk : variant === "gold" ? s.btnGold : s.btnLine, small && s.btnSm, className)} />;
}

export function Kpi({ label, value, sub, hl }: { label: string; value: ReactNode; sub?: ReactNode; hl?: boolean }) {
  return (
    <div className={cx(s.kpi, hl && s.kpiHl)}>
      <small>{label}</small>
      <b>{value}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

export function Card({ title, children, className, as: Tag = "h2" }: { title?: string; children: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <section className={cx(s.card, className)}>
      {title ? <Tag>{title}</Tag> : null}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<{ key: T; label: string; count?: number }>; value: T; onChange: (k: T) => void; label: string }) {
  return (
    <div className={s.tabs} role="group" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key} type="button" aria-pressed={value === t.key} className={cx(s.tab, value === t.key && s.tabOn)} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count !== undefined ? ` (${t.count})` : ""}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={cx(s.tg, on && s.tgOn)} onClick={() => onChange(!on)} />;
}

export function SwitchRow({ title, sub, on, onChange, disabled }: { title: string; sub?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={s.sw}>
      <div>
        <b style={{ fontWeight: 500 }}>{title}</b>
        {sub ? <small>{sub}</small> : null}
      </div>
      <Toggle on={on} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

export function AField({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode }) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      {children({ id, ...(hint || error ? { "aria-describedby": `${id}-d` } : {}), ...(error ? { "aria-invalid": true } : {}) })}
      {error ? (
        <span id={`${id}-d`} className={s.fieldErr} role="alert">
          {error}
        </span>
      ) : hint ? (
        <small id={`${id}-d`}>{hint}</small>
      ) : null}
    </div>
  );
}

export function Table({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.tblWrap} role="region" aria-label={label} tabIndex={0}>
      <table className={s.table}>{children}</table>
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <h3>{title}</h3>
      {text ? <p style={{ margin: 0 }}>{text}</p> : null}
      {action}
    </div>
  );
}

/** Shows a designed loading, error or empty state around a query, then the content. */
export function QueryView<T>({ q, isEmpty, empty, children }: { q: Query<T>; isEmpty?: (d: T) => boolean; empty?: ReactNode; children: (d: T) => ReactNode }) {
  if (q.error && q.data === undefined) {
    return (
      <div role="alert">
        <Empty title="This did not load" text={q.error} action={<Btn small onClick={q.refresh}>Try again</Btn>} />
      </div>
    );
  }
  if (q.data === undefined) {
    return (
      <div role="status" aria-live="polite" style={{ display: "grid", gap: 10, padding: 8 }}>
        <Skeleton height={22} width="40%" />
        <Skeleton height={14} />
        <Skeleton height={14} width="80%" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (isEmpty?.(q.data)) return <>{empty}</>;
  return <>{children(q.data)}</>;
}

export function OwnerOnly({ children, what = "This page" }: { children: ReactNode; what?: string }) {
  const session = useSession();
  if (session?.role !== "owner") {
    return (
      <div className={s.card}>
        <Empty title="Owner only" text={`${what} is for the owner. Sign in as the owner to see it.`} />
      </div>
    );
  }
  return <>{children}</>;
}

/** Runs an action, disables repeat clicks and turns any error into a friendly toast. */
export function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string | ((r: T) => string)): Promise<T | undefined> => {
      if (busyRef.current) return undefined;
      busyRef.current = true;
      setBusy(true);
      try {
        const r = await fn();
        if (ok) toast(typeof ok === "function" ? ok(r) : ok);
        return r;
      } catch (e) {
        toast(messageOf(e), true);
        return undefined;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}
