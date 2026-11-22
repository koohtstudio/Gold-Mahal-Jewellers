/** Integer money helpers. Everything is cents and milligrams. Rounding is half to even (banker safe). */

export function divHE(n: number, d: number): number {
  if (d <= 0) throw new RangeError("divHE: divisor must be positive");
  if (n < 0) return -divHE(-n, d);
  let q = Math.floor(n / d);
  while (q * d > n) q--;
  while ((q + 1) * d <= n) q++;
  const twice = (n - q * d) * 2;
  if (twice < d) return q;
  if (twice > d) return q + 1;
  return q % 2 === 0 ? q : q + 1;
}

const CAD = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CAD0 = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** $1,234.56 */
export function money(cents: number): string {
  return CAD.format(cents / 100);
}

/** $1,235 (whole dollars, rounded half to even on cents first) */
export function moneyWhole(cents: number): string {
  return CAD0.format(divHE(Math.max(0, cents), 100));
}

/** 1.6 g */
export function grams(milli: number, digits = 1): string {
  return `${(milli / 1000).toFixed(digits)} g`;
}

/** Parse "12.4" or "$1,250.50" into integer milli or cents. Returns null when it is not a number. */
export function parseDecimal(input: string, scale: number): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * scale);
}

export const parseCents = (s: string) => parseDecimal(s, 100);
export const parseMilli = (s: string) => parseDecimal(s, 1000);

/** CSV and plain decimal, no symbol: 1234.5 -> "1234.50" */
export function plain(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
