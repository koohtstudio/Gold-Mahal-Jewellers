"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useCallback, useContext, useId, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useImageUrl, useReviewMode } from "@/lib/hooks";
import s from "./ui.module.css";

export { Icon, type IconName } from "./Icon";
export { Dialog, CloseButton } from "./Dialog";

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");

type Variant = "gold" | "line" | "ink";

export function Button({ variant = "gold", small, block, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; block?: boolean }) {
  return <button type="button" {...rest} className={cx(s.btn, s[variant], small && s.sm, block && s.block, className)} />;
}

export function LinkButton({ href, variant = "gold", small, block, className, children, ...rest }: { href: string; variant?: Variant; small?: boolean; block?: boolean; className?: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const cls = cx(s.btn, s[variant], small && s.sm, block && s.block, className);
  return href.startsWith("tel:") || href.startsWith("mailto:") ? (
    <a href={href} className={cls} {...rest}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

export function Chip({ on, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button type="button" aria-pressed={on} {...rest} className={cx(s.chip, on && s.chipOn, className)}>
      {children}
    </button>
  );
}

export function Chips({ children, scroll, label }: { children: ReactNode; scroll?: boolean; label?: string }) {
  return (
    <div className={cx(s.chips, scroll && s.scroll)} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function Stepper({ value, label, onMinus, onPlus, minusLabel, plusLabel, canMinus = true }: { value: string; label: string; onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string; canMinus?: boolean }) {
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <button type="button" onClick={onMinus} aria-label={minusLabel} disabled={!canMinus}>
        &minus;
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={onPlus} aria-label={plusLabel}>
        +
      </button>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <span className={s.label}>{children}</span>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode }) {
  const id = useId();
  const descId = `${id}-d`;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label} style={{ margin: 0 }}>
        {label}
      </label>
      {children({ id, ...(hint || error ? { "aria-describedby": descId } : {}), ...(error ? { "aria-invalid": true } : {}) })}
      {error ? (
        <p id={descId} className={s.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className={s.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className={s.eyebrow}>{children}</span>;
}

export function Heading({ as: Tag = "h2", children, className }: { as?: "h1" | "h2" | "h3"; children: ReactNode; className?: string }) {
  return <Tag className={cx(s.h2, className)}>{children}</Tag>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className={s.lead}>{children}</p>;
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx(s.note, className)}>{children}</p>;
}

type PillTone = "new" | "ready" | "ok" | "sold" | "out" | "low" | "gold" | "plain";
const PILL: Record<PillTone, string | undefined> = { new: s.pNew, ready: s.pReady, ok: s.pOk, sold: s.pSold, out: s.pOut, low: s.pLow, gold: s.pGold, plain: undefined };
export function Pill({ tone = "plain", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={cx(s.pill, PILL[tone])}>{children}</span>;
}

/** Shows "[confirm]" only with ?review=1, next to facts the owner still has to approve. */
export function Confirm({ why }: { why?: string }) {
  const on = useReviewMode();
  if (!on) return null;
  return (
    <span title={why} style={{ background: "#f1dda0", color: "#5e4308", font: "500 11px var(--font-body)", padding: "1px 6px", marginLeft: 6, letterSpacing: ".04em", whiteSpace: "nowrap" }}>
      [confirm]
    </span>
  );
}

export function StateBlock({ kind, title, text, action, dark }: { kind: "empty" | "error" | "loading"; title?: string; text?: string; action?: ReactNode; dark?: boolean }) {
  if (kind === "loading") {
    return (
      <div className={cx(s.state, dark && s.stateDark)} role="status" aria-live="polite">
        <span className={cx(s.skeleton, dark && s.skeletonDark)} style={{ width: 160, height: 18 }} />
        <span className={cx(s.skeleton, dark && s.skeletonDark)} style={{ width: 260, height: 12 }} />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  return (
    <div className={cx(s.state, dark && s.stateDark, kind === "error" && s.stateError)} role={kind === "error" ? "alert" : undefined}>
      <h3>{title ?? (kind === "error" ? "Something went wrong" : "Nothing here yet")}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ width, height = 16, dark }: { width?: number | string; height?: number | string; dark?: boolean }) {
  return <span className={cx(s.skeleton, dark && s.skeletonDark)} style={{ width: width ?? "100%", height }} aria-hidden="true" />;
}

/** Bundled photos go through next/image. Photos the owner uploads live in browser storage and use a plain img. */
export function ProductImage({ src, alt, sizes, priority, className }: { src: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  const url = useImageUrl(src);
  if (!url) return <span className={cx(s.skeleton, s.skeletonDark)} style={{ position: "absolute", inset: 0 }} aria-hidden="true" />;
  if (!url.startsWith("/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={className} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  return <Image src={url} alt={alt} fill sizes={sizes} priority={priority} className={className} style={{ objectFit: "cover" }} />;
}

/* Toasts */

interface ToastItem {
  id: number;
  text: string;
  error?: boolean;
}
const ToastCtx = createContext<(text: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((a) => [...a.slice(-2), { id, text, error }]);
    setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), error ? 6000 : 3500);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className={s.toastHost} aria-live="polite" role="status">
        {items.map((t) => (
          <div key={t.id} className={cx(s.toast, t.error && s.toastErr)}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
