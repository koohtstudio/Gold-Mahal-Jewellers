import { describe, expect, it } from "vitest";
import { isDomainError } from "@/lib/domain/errors";
import type { Reservation } from "@/lib/domain/schemas";
import type { TestHarness } from "@/lib/repo/testing";
import { windowDates, windowsFor, zonedToDate } from "@/lib/time";

/**
 * The repo contract. Any adapter (mock, demo, neon) must pass this suite.
 * The factory returns a fresh, seeded repo with a movable clock (2026-11-21 noon Toronto) and a switchable session.
 */
export function runRepoContract(name: string, factory: () => TestHarness) {
  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return "ok";
    } catch (e) {
      return isDomainError(e) ? e.code : `other:${String(e)}`;
    }
  };

  // Sunday Nov 22, 1 pm to 3 pm window, Sunday opens 11:00 and closes 7:30 pm.
  const sunday = () => {
    const w = windowsFor(11 * 60, 19 * 60 + 30)[1]!;
    const { start, end } = windowDates("2026-11-22", w);
    return { visitStartAt: start.toISOString(), visitEndAt: end.toISOString() };
  };
  const reserve = (h: TestHarness, pieceId: string, option: string, extra: Record<string, unknown> = {}) =>
    h.repo.reservations.create({ lines: [{ pieceId, option, qty: 1 }], name: "Test Customer", phone: "416 555 0100", ...sunday(), _t: 5000, ...extra } as never);

  describe(`repo contract: ${name}`, () => {
    it("seeds a rate, a public shop and hides unlisted pieces", async () => {
      const h = factory();
      expect((await h.repo.rates.current()).rate24Cents).toBe(20800);
      const pub = await h.repo.pieces.list();
      expect(pub.length).toBe(11);
      expect(pub.every((p) => p.visible)).toBe(true);
      expect(await code(h.repo.pieces.list({ includeHidden: true }))).toBe("forbidden");
    });

    it("reserves a piece: code, locked rate, HST, hold and a text", async () => {
      const h = factory();
      const r = await reserve(h, "p-tops", "Pair");
      expect(r.code).toMatch(/^GM-\d{4}$/);
      expect(r.lockedRate24Cents).toBe(20800);
      expect(r.hstCents).toBe(Math.round(r.subtotalCents * 0.13));
      expect(r.totalCents).toBe(r.subtotalCents + r.hstCents);
      expect(new Date(r.holdUntil).getTime() - h.now().getTime()).toBeGreaterThanOrEqual(48 * 3600_000);
      const after = (await h.repo.pieces.list()).find((p) => p.id === "p-tops")!;
      expect(after.unitsReserved).toBe(1);
      h.auth.set("owner");
      const sent = await h.repo.ports.notify.list();
      expect(sent.some((m) => m.kind === "reservation" && m.body.includes(r.code))).toBe(true);
    });

    it("keeps the locked rate when the owner publishes a new one", async () => {
      const h = factory();
      const r = await reserve(h, "p-tops", "Pair");
      h.auth.set("owner");
      await h.repo.rates.publish(22000);
      h.auth.set(null);
      const again = await h.repo.reservations.lookup(r.code, "0100");
      expect(again?.lockedRate24Cents).toBe(20800);
      const r2 = await reserve(h, "p-tops", "Pair");
      expect(r2.lockedRate24Cents).toBe(22000);
      expect(r2.subtotalCents).toBeGreaterThan(r.subtotalCents);
    });

    it("refuses a piece that is already held or sold", async () => {
      const h = factory();
      expect(await code(reserve(h, "p-jhumka", "Pair"))).toBe("sold_out");
      expect(await code(reserve(h, "p-bangle-pair", "Pair"))).toBe("not_found");
    });

    it("rejects unknown fields, bad phones and unknown options", async () => {
      const h = factory();
      expect(await code(reserve(h, "p-tops", "Pair", { admin: true }))).toBe("validation");
      expect(await code(reserve(h, "p-tops", "Pair", { phone: "12345" }))).toBe("validation");
      expect(await code(reserve(h, "p-cuban", "99 in"))).toBe("validation");
    });

    it("honeypot stores nothing, a fast submit is refused", async () => {
      const h = factory();
      const fake = await reserve(h, "p-tops", "Pair", { _hp: "http://spam" });
      expect(fake.code).toBe("GM-0000");
      expect((await h.repo.pieces.list()).find((p) => p.id === "p-tops")!.unitsReserved).toBe(0);
      expect(await code(reserve(h, "p-tops", "Pair", { _t: 100 }))).toBe("too_fast");
    });

    it("is closed on Mondays and caps each window", async () => {
      const h = factory();
      const w = windowsFor(11 * 60 + 30, 19 * 60)[1]!;
      const { start, end } = windowDates("2026-11-23", w);
      expect(await code(reserve(h, "p-tops", "Pair", { visitStartAt: start.toISOString(), visitEndAt: end.toISOString() }))).toBe("closed");
      // The Sunday 1 pm window already has one seeded booking. With a cap of 2, one more fits and the next is full.
      h.auth.set("owner");
      await h.repo.settings.update({ slotCapacity: 2 });
      h.auth.set(null);
      expect(await code(reserve(h, "p-bar10", "10 g"))).toBe("ok");
      expect(await code(reserve(h, "p-bar10", "10 g"))).toBe("conflict");
    });

    it("gates the admin by role", async () => {
      const h = factory();
      expect(await code(h.repo.reservations.list())).toBe("forbidden");
      expect(await code(h.repo.rates.publish(21000))).toBe("forbidden");
      h.auth.set("staff");
      expect(await code(h.repo.reservations.list())).toBe("ok");
      expect(await code(h.repo.rates.publish(21000))).toBe("forbidden");
      expect(await code(h.repo.books.ledger({ from: "2026-11-01", to: "2026-11-30" }))).toBe("forbidden");
      expect(await code(h.repo.audit.list())).toBe("forbidden");
      expect(await code(h.repo.settings.update({ holdHours: 24 }))).toBe("forbidden");
      h.auth.set("owner");
      expect(await code(h.repo.rates.publish(21000))).toBe("ok");
      expect(await code(h.repo.books.ledger({ from: "2026-11-01", to: "2026-11-30" }))).toBe("ok");
    });

    it("rejects an absurd rate", async () => {
      const h = factory();
      h.auth.set("owner");
      expect(await code(h.repo.rates.publish(5))).toBe("validation");
      expect(await code(h.repo.rates.publish(20800.5))).toBe("validation");
    });

    it("ready then sold writes the ledger and marks the piece sold", async () => {
      const h = factory();
      const r = await reserve(h, "p-pendantset", "Set");
      h.auth.set("owner");
      const before = (await h.repo.books.ledger({ from: "2026-11-01", to: "2026-11-30" })).length;
      const ready = await h.repo.reservations.markReady(r.id);
      expect(ready.status).toBe("ready");
      expect(await code(h.repo.reservations.markReady(r.id))).toBe("bad_state");
      const sold = await h.repo.reservations.markSold(r.id);
      expect(sold.status).toBe("sold");
      const rows = await h.repo.books.ledger({ from: "2026-11-01", to: "2026-11-30" });
      expect(rows.length).toBe(before + 1);
      const row = rows.find((e) => e.ref === r.code)!;
      expect(row.netCents).toBe(r.subtotalCents);
      expect(row.hstCents).toBe(r.hstCents);
      expect(row.source).toBe("reservation");
      const piece = (await h.repo.pieces.list({ includeHidden: true })).find((p) => p.id === "p-pendantset")!;
      expect([piece.unitsReserved, piece.unitsSold]).toEqual([0, 1]);
      expect(await code(h.repo.reservations.release(r.id))).toBe("bad_state");
    });

    it("splits a bar into bullion with no HST", async () => {
      const h = factory();
      const r = await h.repo.reservations.create({ lines: [{ pieceId: "p-bar10", option: "10 g", qty: 1 }, { pieceId: "p-tops", option: "Pair", qty: 1 }], name: "Mix Customer", phone: "4165550100", ...sunday(), _t: 5000 } as never);
      h.auth.set("owner");
      await h.repo.reservations.markSold(r.id);
      const rows = (await h.repo.books.ledger({ from: "2026-11-01", to: "2026-11-30" })).filter((e) => e.ref === r.code);
      expect(rows.map((e) => e.source).sort()).toEqual(["bullion", "reservation"]);
      expect(rows.find((e) => e.source === "bullion")!.hstCents).toBe(0);
    });

    it("released and expired holds never reach the books and free the piece", async () => {
      const h = factory();
      const a = await reserve(h, "p-tops", "Pair");
      const b = await reserve(h, "p-pendantset", "Set");
      h.auth.set("owner");
      const ledgerBefore = (await h.repo.books.ledger({ from: "2026-01-01", to: "2026-12-31" })).length;
      await h.repo.reservations.release(a.id);
      expect((await h.repo.pieces.list()).find((p) => p.id === "p-tops")!.unitsReserved).toBe(0);
      h.advanceHours(24 * 5);
      expect(await h.repo.reservations.expireDue()).toBeGreaterThanOrEqual(1);
      const all = await h.repo.reservations.list();
      expect(all.find((r) => r.id === b.id)!.status).toBe("expired");
      expect((await h.repo.pieces.list()).find((p) => p.id === "p-pendantset")!.unitsReserved).toBe(0);
      expect((await h.repo.books.ledger({ from: "2026-01-01", to: "2026-12-31" })).length).toBe(ledgerBefore);
    });

    it("lets a customer look up a reservation with the code and last four digits only", async () => {
      const h = factory();
      const r = await reserve(h, "p-tops", "Pair");
      expect((await h.repo.reservations.lookup(r.code, "0100"))?.id).toBe(r.id);
      expect(await h.repo.reservations.lookup(r.code, "9999")).toBeNull();
      expect(await h.repo.reservations.lookup("GM-0001", "0100")).toBeNull();
      h.auth.set("owner");
      await h.repo.reservations.markReady(r.id);
      h.auth.set(null);
      expect((await h.repo.reservations.lookup(r.code, "0100"))?.status).toBe("ready");
    });

    it("reprices open reservations when the rate lock is off", async () => {
      const h = factory();
      const r = await reserve(h, "p-tops", "Pair");
      h.auth.set("owner");
      await h.repo.settings.update({ lockRate: false });
      await h.repo.rates.publish(22400);
      const view = (await h.repo.reservations.list()).find((x: Reservation) => x.id === r.id)!;
      expect(view.lockedRate24Cents).toBe(22400);
      expect(view.subtotalCents).toBeGreaterThan(r.subtotalCents);
    });

    it("blocks an old gold payout without the ID check and masks ID references", async () => {
      const h = factory();
      h.auth.set("staff");
      expect(await code(h.repo.oldGold.add({ customer: "Walk in", karat: 22, gramsMilli: 10000, idChecked: false, idRef: "DL 1234" }))).toBe("id_required");
      const og = await h.repo.oldGold.add({ customer: "Walk in", karat: 22, gramsMilli: 10000, idChecked: true, idRef: "DL 1234" });
      expect(og.pureGramsMilli).toBe(9167);
      expect(og.paidCents).toBe(179233);
      expect(og.idRef).toBe("On file");
      expect((await h.repo.oldGold.list()).every((o) => o.idRef === "On file")).toBe(true);
      expect(await code(h.repo.oldGold.revealId(og.id))).toBe("forbidden");
      h.auth.set("owner");
      expect(await h.repo.oldGold.revealId(og.id)).toBe("DL 1234");
      expect((await h.repo.audit.list()).some((a) => a.action === "oldgold.id.view")).toBe(true);
    });

    it("uses the buy rate setting for old gold", async () => {
      const h = factory();
      h.auth.set("owner");
      await h.repo.settings.update({ buyRatePct: 90 });
      const og = await h.repo.oldGold.add({ customer: "", karat: 24, gramsMilli: 5000, idChecked: true, idRef: "ID" });
      expect(og.customer).toBe("Walk in");
      expect(og.buyRateCents).toBe(18720);
      expect(og.paidCents).toBe(93600);
    });

    it("records a layaway payment into the books and closes the plan when paid", async () => {
      const h = factory();
      h.auth.set("owner");
      const plan = (await h.repo.layaway.list()).find((l) => l.customer === "Harpreet S.")!;
      const before = (await h.repo.books.ledger({ from: "2026-11-01", to: "2026-11-30" })).filter((e) => e.source === "layaway").length;
      const next = await h.repo.layaway.recordPayment(plan.id);
      expect(next.paidCents).toBe(plan.paidCents + plan.instalmentCents);
      const rows = (await h.repo.books.ledger({ from: "2026-11-01", to: "2026-11-30" })).filter((e) => e.source === "layaway");
      expect(rows.length).toBe(before + 1);
      const final = await h.repo.layaway.recordPayment(plan.id, 99_999_999);
      expect(final.paidCents).toBe(final.totalCents);
      expect(final.nextDue).toBe("");
      expect(await code(h.repo.layaway.recordPayment(plan.id))).toBe("bad_state");
    });

    it("adds expenses with HST by category and keeps insurance at zero", async () => {
      const h = factory();
      h.auth.set("owner");
      const rent = await h.repo.books.addExpense({ vendor: "Landlord", category: "Rent", netCents: 100000 });
      expect(rent.hstCents).toBe(13000);
      const ins = await h.repo.books.addExpense({ vendor: "Insurer", category: "Insurance", netCents: 50000 });
      expect(ins.hstCents).toBe(0);
      expect(await code(h.repo.books.addExpense({ vendor: "x", category: "Rent", netCents: 1 }))).toBe("validation");
    });

    it("sells a piece at the counter once", async () => {
      const h = factory();
      h.auth.set("staff");
      const rows = await h.repo.pieces.sellAtCounter("p-cuban", { customer: "" });
      expect(rows[0]?.source).toBe("counter");
      expect(await code(h.repo.pieces.sellAtCounter("p-cuban", { customer: "" }))).toBe("sold_out");
    });

    it("moves a job from intake to ready and takes the balance once", async () => {
      const h = factory();
      h.auth.set("staff");
      const job = await h.repo.jobs.add({ customer: "Test Person", phone: "4165550100", type: "repair", title: "Chain repair", quoteCents: 5000, depositCents: 1000, dueDate: "2026-11-30" });
      expect((await h.repo.jobs.advance(job.id)).stage).toBe("workshop");
      expect((await h.repo.jobs.advance(job.id)).stage).toBe("ready");
      expect(await code(h.repo.jobs.advance(job.id))).toBe("bad_state");
      expect((await h.repo.jobs.collectBalance(job.id)).closedAt).toBeTruthy();
      expect(await code(h.repo.jobs.collectBalance(job.id))).toBe("bad_state");
    });

    it("sends the books to the accountant and records history", async () => {
      const h = factory();
      h.auth.set("staff");
      const period = h.repo.books.periods()[1]!;
      expect(await code(h.repo.ports.accountant.send(period, "standard"))).toBe("forbidden");
      h.auth.set("owner");
      const before = (await h.repo.ports.accountant.history()).length;
      const log = await h.repo.ports.accountant.send(period, "quickbooks");
      expect(log.status).toBe("sent");
      expect((await h.repo.ports.accountant.history()).length).toBe(before + 1);
      expect((await h.repo.ports.notify.list()).some((m) => m.kind === "accountant" && m.subject?.includes(period.label))).toBe(true);
    });

    it("saves visit requests and valuations for admin only", async () => {
      const h = factory();
      const v = await h.repo.visits.addVisit({ type: "Repairs and resizing", preferredDate: "2026-11-24", name: "Visit Person", phone: "416 555 0101", _t: 5000 });
      expect(v.status).toBe("new");
      const val = await h.repo.visits.addValuation({ karat: 22, gramsMilli: 10000, name: "Val Person", phone: "416 555 0102", preferredDate: "2026-11-24", _t: 5000 });
      expect(val.estimateCents).toBe(179233);
      expect(await code(h.repo.visits.listVisits())).toBe("forbidden");
      h.auth.set("staff");
      expect((await h.repo.visits.listVisits()).some((x) => x.id === v.id)).toBe(true);
      expect((await h.repo.visits.listValuations()).some((x) => x.id === val.id)).toBe(true);
    });

    it("adds a piece with a tag and a unique slug", async () => {
      const h = factory();
      h.auth.set("staff");
      const input = { name: "22k Test Bangle", category: "Bridal" as const, karat: 22 as const, netGramsMilli: 12400, makingBps: 800, stoneCents: 0, units: 1, image: "/images/bangles-red.jpg" };
      const a = await h.repo.pieces.add(input);
      const b = await h.repo.pieces.add(input);
      expect(a.tag).toBe("GM-1016");
      expect(b.slug).toBe(`${a.slug}-2`);
      expect(await code(h.repo.pieces.add({ ...input, karat: null }))).toBe("validation");
    });

    it("notifies subscribers on change and resets to the seed", async () => {
      const h = factory();
      let n = 0;
      const off = h.repo.subscribe(() => n++);
      await h.repo.ready();
      h.auth.set("owner");
      n = 0;
      await h.repo.rates.publish(21000);
      expect(n).toBeGreaterThan(0);
      expect((await h.repo.rates.current()).rate24Cents).toBe(21000);
      await h.repo.reset();
      expect((await h.repo.rates.current()).rate24Cents).toBe(20800);
      off();
    });

    it("keeps the owner's rate history to the most recent mornings", async () => {
      const h = factory();
      const hist = await h.repo.rates.history(7);
      expect(hist.length).toBe(7);
      expect(hist.at(-1)?.rate24Cents).toBe(20800);
      expect(zonedToDate(2026, 11, 21, 9, 30).getTime()).toBeGreaterThan(0);
    });
  });
}
