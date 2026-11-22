import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mock/seed";
import { handleGet, handlePost, MemoryDocStore, MAX_BODY_BYTES } from "@/lib/demo/server";
import { RemoteBackend } from "@/lib/repo/backends";
import { makeHarness } from "@/lib/repo/testing";
import { runRepoContract } from "../contract/contract";

let n = 0;
/** A fetch that talks straight to the demo route logic, so the browser side and the server side are tested together. */
function fakeFetch(store: MemoryDocStore) {
  const client = `test-${++n}`;
  return async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    const room = url.searchParams.get("room");
    const reply = init?.method === "POST" ? await handlePost(store, room, String(init.body), client) : await handleGet(store, room, Number(url.searchParams.get("since") ?? "0"), client);
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  };
}

let rooms = 0;
runRepoContract("demo adapter (remote backend over the demo route)", () => {
  const store = new MemoryDocStore();
  const room = `room-${++rooms}`;
  return makeHarness({ backend: new RemoteBackend(() => room, fakeFetch(store), 60_000) });
});

describe("demo route", () => {
  const doc = () => buildSeed(new Date("2026-11-21T17:00:00Z"));
  it("creates a room, updates it and reports changes since a version", async () => {
    const store = new MemoryDocStore();
    expect((await handleGet(store, "pitch", 0, "a")).body).toEqual({ changed: false, version: 0 });
    const created = await handlePost(store, "pitch", JSON.stringify({ expectedVersion: 0, data: doc() }), "a");
    expect(created).toEqual({ status: 200, body: { version: 1 } });
    const updated = await handlePost(store, "pitch", JSON.stringify({ expectedVersion: 1, data: doc() }), "a");
    expect((updated.body as { version: number }).version).toBe(2);
    expect((await handleGet(store, "pitch", 2, "a")).body).toEqual({ changed: false, version: 2 });
    const changed = (await handleGet(store, "pitch", 1, "a")).body as { changed: boolean; version: number };
    expect(changed.changed).toBe(true);
    expect(changed.version).toBe(2);
  });
  it("answers a stale write with 409 and the current document", async () => {
    const store = new MemoryDocStore();
    await handlePost(store, "pitch", JSON.stringify({ expectedVersion: 0, data: doc() }), "b");
    await handlePost(store, "pitch", JSON.stringify({ expectedVersion: 1, data: doc() }), "b");
    const stale = await handlePost(store, "pitch", JSON.stringify({ expectedVersion: 1, data: doc() }), "b");
    expect(stale.status).toBe(409);
    expect((stale.body as { version: number }).version).toBe(2);
    const dup = await handlePost(store, "pitch", JSON.stringify({ expectedVersion: 0, data: doc() }), "b");
    expect(dup.status).toBe(409);
  });
  it("rejects bad rooms, bad JSON, wrong shapes, extra fields and oversize bodies", async () => {
    const store = new MemoryDocStore();
    expect((await handleGet(store, "Bad Room!", 0, "c")).status).toBe(400);
    expect((await handlePost(store, null, "{}", "c")).status).toBe(400);
    expect((await handlePost(store, "pitch", "{nope", "c")).status).toBe(400);
    expect((await handlePost(store, "pitch", JSON.stringify({ expectedVersion: 0, data: { version: 1 } }), "c")).status).toBe(422);
    expect((await handlePost(store, "pitch", JSON.stringify({ expectedVersion: 0, data: doc(), admin: true }), "c")).status).toBe(422);
    expect((await handlePost(store, "pitch", "x".repeat(MAX_BODY_BYTES + 1), "c")).status).toBe(413);
  });
  it("rate limits a client that writes too fast", async () => {
    const store = new MemoryDocStore();
    let last = 0;
    for (let i = 0; i < 125; i++) last = (await handlePost(store, "spam", "{}", "flood")).status;
    expect(last).toBe(429);
  });
});

describe("two devices in one room", () => {
  it("a change on one shows up on the other through polling", async () => {
    const store = new MemoryDocStore();
    const a = makeHarness({ backend: new RemoteBackend(() => "shared", fakeFetch(store), 15), role: "owner" });
    const b = makeHarness({ backend: new RemoteBackend(() => "shared", fakeFetch(store), 15) });
    await a.repo.ready();
    await b.repo.ready();
    let seen = 0;
    b.repo.subscribe(() => seen++);
    await a.repo.rates.publish(21500);
    await new Promise((r) => setTimeout(r, 120));
    expect(seen).toBeGreaterThan(0);
    expect((await b.repo.rates.current()).rate24Cents).toBe(21500);
  });
  it("two writers at once both land, one retries on conflict", async () => {
    const store = new MemoryDocStore();
    const a = makeHarness({ backend: new RemoteBackend(() => "race", fakeFetch(store), 60_000), role: "owner" });
    const b = makeHarness({ backend: new RemoteBackend(() => "race", fakeFetch(store), 60_000), role: "owner" });
    await Promise.all([a.repo.ready(), b.repo.ready()]);
    await Promise.all([a.repo.rates.publish(21000), b.repo.books.addExpense({ vendor: "Racer", category: "Rent", netCents: 100000 })]);
    const rate = await a.repo.rates.current();
    expect([21000, 20800]).toContain(rate.rate24Cents);
    await new Promise((r) => setTimeout(r, 20));
    const fresh = makeHarness({ backend: new RemoteBackend(() => "race", fakeFetch(store), 60_000), role: "owner" });
    const expenses = await fresh.repo.books.expenses({ from: "2000-01-01", to: "2100-01-01" });
    expect(expenses.some((e) => e.vendor === "Racer")).toBe(true);
    expect((await fresh.repo.rates.history(20)).some((r) => r.rate24Cents === 21000)).toBe(true);
  });
});
