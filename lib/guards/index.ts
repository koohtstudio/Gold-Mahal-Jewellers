/** Phone validation, honeypot, time to submit and a small in-memory rate limiter. */

/** Returns 10 digits (North American) or null. Accepts a leading 1 and common punctuation. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return null;
  // NANP: area code and exchange cannot start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
  return d;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

export function formatPhone(input: string): string {
  const d = normalizePhone(input);
  if (!d) return input;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function lastFour(input: string): string {
  const d = input.replace(/\D/g, "");
  return d.slice(-4);
}

export const MIN_SUBMIT_MS = 1500;

export type SubmissionVerdict = "ok" | "spam" | "too_fast";

/** Honeypot: a filled hidden field means a bot. Time to submit: humans take more than a second and a half. */
export function judgeSubmission(opts: { honeypot?: string; elapsedMs?: number }): SubmissionVerdict {
  if (opts.honeypot && opts.honeypot.trim().length > 0) return "spam";
  if (typeof opts.elapsedMs === "number" && opts.elapsedMs < MIN_SUBMIT_MS) return "too_fast";
  return "ok";
}

/** Sliding window limiter. In memory only: a stub for the mock and a per instance guard in live mode. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
