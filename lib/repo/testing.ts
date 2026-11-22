import type { Role } from "@/lib/domain/schemas";
import { buildSeed } from "@/lib/mock/seed";
import { zonedToDate } from "@/lib/time";
import { MemoryBackend, type DocBackend } from "./backends";
import { createRepo } from "./create";
import { createMemoryAuth, createMemoryStorage } from "./ports";
import type { Repo } from "./types";

export interface TestHarness {
  repo: Repo;
  auth: ReturnType<typeof createMemoryAuth>;
  backend: DocBackend;
  setNow(d: Date): void;
  advanceHours(h: number): void;
  now(): Date;
}

/** A repo wired to memory, a movable clock and a switchable session. Used by the contract suite and unit tests. */
export function makeHarness(opts: { backend?: DocBackend; now?: Date; role?: Role | null } = {}): TestHarness {
  let t = opts.now ?? zonedToDate(2026, 11, 21, 12, 0);
  const auth = createMemoryAuth(opts.role ?? null);
  const backend = opts.backend ?? new MemoryBackend();
  let n = 0;
  const repo = createRepo({
    mode: "mock", backend, seed: buildSeed, auth, storage: createMemoryStorage(), latency: null,
    now: () => t,
    // Deterministic codes: 2000 + 37, 2000 + 74, ...
    random: () => ((++n * 37) % 8000) / 8000,
  });
  return { repo, auth, backend, setNow: (d) => (t = d), advanceHours: (h) => (t = new Date(t.getTime() + h * 3600_000)), now: () => t };
}
