import { DAYS } from "@/lib/domain/constants";
import type { DayKey, Settings } from "@/lib/domain/schemas";

/** The shop is in Brampton, Ontario. All calendar logic uses this zone, whatever the visitor's device says. */
export const SHOP_TZ = "America/Toronto";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  dow: number;
}

export function tzParts(date: Date): ZonedParts {
  const o: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(date)) o[p.type] = p.value;
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day), h: Number(o.hour) % 24, min: Number(o.minute), dow: DOW[o.weekday ?? "Sun"] ?? 0 };
}

function offsetMinutes(date: Date): number {
  const p = tzParts(date);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, 0);
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

/** Wall clock time in Toronto to a real instant. */
export function zonedToDate(y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = offsetMinutes(new Date(guess));
  let t = guess - off * 60000;
  const off2 = offsetMinutes(new Date(t));
  if (off2 !== off) t = guess - off2 * 60000;
  return new Date(t);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD in Toronto. */
export function isoDate(date: Date): string {
  const p = tzParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function parseIsoDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseIsoDate(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function dowOf(iso: string): number {
  const { y, m, d } = parseIsoDate(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function dayLabel(iso: string, long = false): string {
  const { m, d } = parseIsoDate(iso);
  const dow = dowOf(iso);
  return `${long ? DOW_LONG[dow] : DOW_SHORT[dow]}, ${MON[m - 1]} ${d}`;
}

export function shortDate(iso: string): string {
  const { m, d } = parseIsoDate(iso);
  return `${MON[m - 1]} ${d}`;
}

export function monthDay(iso: string): { dow: string; num: string; mon: string } {
  const { m, d } = parseIsoDate(iso);
  return { dow: DOW_SHORT[dowOf(iso)] ?? "", num: String(d), mon: MON[m - 1] ?? "" };
}

/** 11:30 -> "11:30 am", 13:00 -> "1 pm" */
export function clock(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "am" : "pm";
  return m === 0 ? `${h} ${suffix}` : `${h}:${pad(m)} ${suffix}`;
}

export function timeLabel(date: Date): string {
  const p = tzParts(date);
  return clock(p.h * 60 + p.min);
}

/** "Today at 9:30 am", "Yesterday at 4 pm" or "Nov 18 at 9:30 am" */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = isoDate(d);
  const today = isoDate(now);
  const t = timeLabel(d);
  if (day === today) return `today at ${t}`;
  if (day === addDays(today, -1)) return `yesterday at ${t}`;
  return `${shortDate(day)} at ${t}`;
}

export function dayKey(iso: string): DayKey {
  return DAYS[dowOf(iso)] ?? "sun";
}

export interface OpenDay {
  date: string;
  dow: string;
  num: string;
  mon: string;
  label: string;
  openMin: number;
  closeMin: number;
}

/** The next `count` days the shop is open. Monday is closed because the hours say so. */
export function nextOpenDays(now: Date, settings: Pick<Settings, "hours" | "sameDay">, count = 8): OpenDay[] {
  const out: OpenDay[] = [];
  const today = isoDate(now);
  const p = tzParts(now);
  const nowMin = p.h * 60 + p.min;
  let cursor = today;
  for (let i = 0; i < 60 && out.length < count; i++, cursor = addDays(cursor, 1)) {
    const h = settings.hours[dayKey(cursor)];
    if (!h) continue;
    if (cursor === today) {
      if (!settings.sameDay) continue;
      if (nowMin >= h.close - 60) continue;
    }
    const md = monthDay(cursor);
    out.push({ date: cursor, ...md, label: dayLabel(cursor, true), openMin: h.open, closeMin: h.close });
  }
  return out;
}

export interface VisitWindow {
  startMin: number;
  endMin: number;
  label: string;
}

/** Two hour windows across the opening hours. Matches the design: 11:30 to 1, 1 to 3, 3 to 5, 5 to close. */
export function windowsFor(openMin: number, closeMin: number): VisitWindow[] {
  const marks: number[] = [];
  for (let h = 9; h <= 21; h += 2) {
    const t = h * 60;
    if (t >= openMin + 60 && t <= closeMin - 60) marks.push(t);
  }
  const bounds = [openMin, ...marks, closeMin];
  const out: VisitWindow[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i] as number;
    const b = bounds[i + 1] as number;
    out.push({ startMin: a, endMin: b, label: `${clock(a)} to ${clock(b)}` });
  }
  return out;
}

export function windowDates(date: string, w: VisitWindow): { start: Date; end: Date } {
  const { y, m, d } = parseIsoDate(date);
  return {
    start: zonedToDate(y, m, d, Math.floor(w.startMin / 60), w.startMin % 60),
    end: zonedToDate(y, m, d, Math.floor(w.endMin / 60), w.endMin % 60),
  };
}

/* Periods for the books. */

export type PeriodKey = "this-month" | "last-month" | "quarter";
export interface Period {
  key: PeriodKey;
  label: string;
  /** Inclusive ISO dates. */
  from: string;
  to: string;
  /** Short label used in "Send [label] books" */
  short: string;
}

export function periodsFor(now: Date): Period[] {
  const t = tzParts(now);
  const first = (y: number, m: number) => `${y}-${pad(m)}-01`;
  const lastOf = (y: number, m: number) => addDays(first(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1), -1);
  const lm = t.m === 1 ? { y: t.y - 1, m: 12 } : { y: t.y, m: t.m - 1 };
  const qStartMonth = Math.floor((t.m - 1) / 3) * 3 + 1;
  return [
    { key: "this-month", label: `${MONTHS_LONG[t.m - 1]} ${t.y}`, short: MONTHS_LONG[t.m - 1] ?? "", from: first(t.y, t.m), to: lastOf(t.y, t.m) },
    { key: "last-month", label: `${MONTHS_LONG[lm.m - 1]} ${lm.y}`, short: MONTHS_LONG[lm.m - 1] ?? "", from: first(lm.y, lm.m), to: lastOf(lm.y, lm.m) },
    { key: "quarter", label: `Quarter to date (Q${Math.floor((t.m - 1) / 3) + 1} ${t.y})`, short: `Q${Math.floor((t.m - 1) / 3) + 1}`, from: first(t.y, qStartMonth), to: isoDate(now) },
  ];
}

export function inPeriod(date: string, p: Pick<Period, "from" | "to">): boolean {
  return date >= p.from && date <= p.to;
}
