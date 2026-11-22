import { describe, expect, it } from "vitest";
import { RateLimiter, formatPhone, isValidPhone, judgeSubmission, lastFour, normalizePhone } from "@/lib/guards";
import { addDays, clock, dayLabel, isoDate, nextOpenDays, periodsFor, whenLabel, windowsFor, zonedToDate } from "@/lib/time";
import { ReserveInputSchema, VisitInputSchema } from "@/lib/domain/schemas";
import { defaultSettings } from "@/lib/mock/defaults";

describe("phone validation", () => {
  it("accepts 10 digit North American numbers in common shapes", () => {
    expect(isValidPhone("416 555 0100")).toBe(true);
    expect(isValidPhone("(905) 913-1212")).toBe(true);
    expect(isValidPhone("1-416-555-0100")).toBe(true);
    expect(normalizePhone("+1 647 555 0177")).toBe("6475550177");
  });
  it("rejects short, long and impossible numbers", () => {
    expect(isValidPhone("123456")).toBe(false);
    expect(isValidPhone("041 555 0100")).toBe(false);
    expect(isValidPhone("416 155 0100")).toBe(false);
    expect(isValidPhone("416 555 01000")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
  it("formats and masks", () => {
    expect(formatPhone("4165550100")).toBe("(416) 555-0100");
    expect(lastFour("(416) 555-0142")).toBe("0142");
  });
});

describe("submission guards", () => {
  it("flags a filled honeypot and a too fast submit", () => {
    expect(judgeSubmission({ honeypot: "http://spam", elapsedMs: 9000 })).toBe("spam");
    expect(judgeSubmission({ honeypot: "", elapsedMs: 300 })).toBe("too_fast");
    expect(judgeSubmission({ honeypot: "", elapsedMs: 5000 })).toBe("ok");
    expect(judgeSubmission({})).toBe("ok");
  });
  it("rate limits per key over a window", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.take("a", 0)).toBe(true);
    expect(rl.take("a", 10)).toBe(true);
    expect(rl.take("a", 20)).toBe(false);
    expect(rl.take("b", 20)).toBe(true);
    expect(rl.take("a", 1500)).toBe(true);
  });
});

describe("shop time", () => {
  it("converts Toronto wall time with and without daylight saving", () => {
    expect(zonedToDate(2026, 11, 21, 12, 0).toISOString()).toBe("2026-11-21T17:00:00.000Z");
    expect(zonedToDate(2026, 7, 1, 12, 0).toISOString()).toBe("2026-07-01T16:00:00.000Z");
  });
  it("uses the Toronto date, not the UTC date", () => {
    expect(isoDate(new Date("2026-11-22T02:30:00Z"))).toBe("2026-11-21");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("formats clock and labels", () => {
    expect(clock(690)).toBe("11:30 am");
    expect(clock(780)).toBe("1 pm");
    expect(clock(1170)).toBe("7:30 pm");
    expect(dayLabel("2026-11-22", true)).toBe("Sunday, Nov 22");
    expect(whenLabel("2026-11-21T14:30:00Z", zonedToDate(2026, 11, 21, 18, 0))).toBe("today at 9:30 am");
  });
  it("builds two hour windows that follow the opening hours", () => {
    expect(windowsFor(690, 1140).map((w) => w.label)).toEqual(["11:30 am to 1 pm", "1 pm to 3 pm", "3 pm to 5 pm", "5 pm to 7 pm"]);
    expect(windowsFor(660, 1170).map((w) => w.label)).toEqual(["11 am to 1 pm", "1 pm to 3 pm", "3 pm to 5 pm", "5 pm to 7:30 pm"]);
  });
  it("lists the next 8 open days and skips Monday", () => {
    const now = zonedToDate(2026, 11, 21, 12, 0);
    const days = nextOpenDays(now, defaultSettings(), 8).map((d) => d.date);
    expect(days).toEqual(["2026-11-21", "2026-11-22", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
  });
  it("skips today when it is nearly closing or same day visits are off", () => {
    const late = zonedToDate(2026, 11, 21, 19, 0);
    expect(nextOpenDays(late, defaultSettings(), 1)[0]?.date).toBe("2026-11-22");
    const noSame = nextOpenDays(zonedToDate(2026, 11, 21, 9, 0), { ...defaultSettings(), sameDay: false }, 1);
    expect(noSame[0]?.date).toBe("2026-11-22");
  });
  it("builds this month, last month and quarter to date", () => {
    const [m, lm, q] = periodsFor(zonedToDate(2026, 11, 21, 12, 0));
    expect([m?.from, m?.to]).toEqual(["2026-11-01", "2026-11-30"]);
    expect([lm?.from, lm?.to]).toEqual(["2026-10-01", "2026-10-31"]);
    expect([q?.from, q?.to]).toEqual(["2026-10-01", "2026-11-21"]);
    const jan = periodsFor(zonedToDate(2027, 1, 5, 12, 0));
    expect([jan[1]?.from, jan[1]?.to]).toEqual(["2026-12-01", "2026-12-31"]);
  });
});

describe("input schemas", () => {
  const ok = { lines: [{ pieceId: "p1", option: "Pair", qty: 1 }], name: "Simran", phone: "4165550100", visitStartAt: "2026-11-22T18:00:00Z", visitEndAt: "2026-11-22T20:00:00Z" };
  it("accepts a good reservation", () => {
    expect(ReserveInputSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects unknown fields", () => {
    expect(ReserveInputSchema.safeParse({ ...ok, isAdmin: true }).success).toBe(false);
    expect(ReserveInputSchema.safeParse({ ...ok, lines: [{ pieceId: "p1", option: "Pair", qty: 1, price: 1 }] }).success).toBe(false);
  });
  it("rejects bad quantities and missing lines", () => {
    expect(ReserveInputSchema.safeParse({ ...ok, lines: [] }).success).toBe(false);
    expect(ReserveInputSchema.safeParse({ ...ok, lines: [{ pieceId: "p1", option: "x", qty: 0 }] }).success).toBe(false);
  });
  it("validates visit requests", () => {
    expect(VisitInputSchema.safeParse({ type: "Repairs", preferredDate: "2026-11-24", name: "Ann", phone: "4165550100" }).success).toBe(true);
    expect(VisitInputSchema.safeParse({ type: "Repairs", preferredDate: "tomorrow", name: "Ann", phone: "4165550100" }).success).toBe(false);
  });
});
