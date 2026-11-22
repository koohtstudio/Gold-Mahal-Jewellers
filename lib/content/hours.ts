import type { DayKey, Settings } from "@/lib/domain/schemas";
import { clock } from "@/lib/time";

const ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const NAME: Record<DayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

/** Groups consecutive days with the same hours: Tuesday to Thursday, Friday and Saturday. Monday first, as in the design. */
export function hoursRows(hours: Settings["hours"]): Array<{ label: string; value: string; closed: boolean }> {
  const val = (d: DayKey) => {
    const h = hours[d];
    return h ? `${clock(h.open)} to ${clock(h.close)}` : "Closed";
  };
  const rows: Array<{ label: string; value: string; closed: boolean }> = [];
  let i = 0;
  while (i < ORDER.length) {
    let j = i;
    while (j + 1 < ORDER.length && val(ORDER[j + 1] as DayKey) === val(ORDER[i] as DayKey)) j++;
    const a = NAME[ORDER[i] as DayKey];
    const b = NAME[ORDER[j] as DayKey];
    const label = i === j ? a : j === i + 1 ? `${a} and ${b}` : `${a} to ${b}`;
    rows.push({ label, value: val(ORDER[i] as DayKey), closed: !hours[ORDER[i] as DayKey] });
    i = j + 1;
  }
  return rows;
}

export function openSummary(hours: Settings["hours"]): { open: string; closed: string } {
  const closedDays = ORDER.filter((d) => !hours[d]).map((d) => NAME[d]);
  return { open: "Open Tue to Sun", closed: closedDays.length ? `Closed ${closedDays.map((d) => `${d}s`).join(" and ")}` : "Open every day" };
}
