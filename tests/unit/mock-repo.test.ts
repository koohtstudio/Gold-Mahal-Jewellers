import { describe, expect, it } from "vitest";
import { MemoryBackend } from "@/lib/repo/backends";
import { makeHarness } from "@/lib/repo/testing";
import { parseDoc } from "@/lib/repo/store";
import { buildSeed } from "@/lib/mock/seed";
import { StoreDocSchema } from "@/lib/domain/schemas";
import { zonedToDate } from "@/lib/time";
import { runRepoContract } from "../contract/contract";

runRepoContract("mock adapter (memory backend)", () => makeHarness());

describe("store resilience", () => {
  it("reseeds when storage is corrupt, old or the wrong shape", async () => {
    for (const bad of ["{not json", JSON.stringify({ version: 0 }), JSON.stringify({ version: 1, rates: "nope" }), ""]) {
      const backend = new MemoryBackend();
      await backend.transact(() => bad, {});
      const h = makeHarness({ backend });
      const info = await h.repo.ready();
      expect((await h.repo.rates.current()).rate24Cents).toBe(20800);
      if (bad) expect(info.recovered).toBe(true);
    }
  });

  it("two repos on one backend see each other's changes", async () => {
    const backend = new MemoryBackend();
    const a = makeHarness({ backend, role: "owner" });
    const b = makeHarness({ backend });
    await a.repo.ready();
    await b.repo.ready();
    let seen = 0;
    b.repo.subscribe(() => seen++);
    await a.repo.rates.publish(21234);
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toBeGreaterThan(0);
    expect((await b.repo.rates.current()).rate24Cents).toBe(21234);
  });
});

describe("seed", () => {
  it("is valid and internally consistent on any day of the month", () => {
    for (const d of [zonedToDate(2026, 11, 1, 8, 0), zonedToDate(2026, 11, 21, 12, 0), zonedToDate(2027, 1, 1, 10, 0), zonedToDate(2026, 2, 28, 22, 0)]) {
      const doc = buildSeed(d);
      expect(StoreDocSchema.safeParse(doc).success).toBe(true);
      expect(parseDoc(JSON.stringify(doc))).not.toBeNull();
      for (const p of doc.pieces) {
        const held = doc.reservations.filter((r) => r.status === "new" || r.status === "ready").reduce((a, r) => a + r.lines.filter((l) => l.pieceId === p.id).reduce((s, l) => s + l.qty, 0), 0);
        expect(p.unitsReserved).toBe(held);
        expect(p.units).toBeGreaterThanOrEqual(p.unitsReserved + p.unitsSold);
      }
      expect(new Set(doc.reservations.map((r) => r.code)).size).toBe(doc.reservations.length);
      expect(new Set(doc.pieces.map((p) => p.slug)).size).toBe(doc.pieces.length);
    }
  });
});
