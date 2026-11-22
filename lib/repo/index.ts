import { STORE_KEY, config } from "@/lib/config";
import { buildSeed } from "@/lib/mock/seed";
import { LocalBackend, MemoryBackend, RemoteBackend } from "./backends";
import { createRepo } from "./create";
import { createNeonRepo } from "./neon";
import { createCookieAuth, createIndexedDbStorage, createMemoryAuth, createMemoryStorage } from "./ports";
import type { Repo } from "./types";

export type { Repo } from "./types";

const ROOM_KEY = "gm-room";

/** Demo mode only: ?room=name picks a private room and is remembered on this device. */
function currentRoom(): string {
  try {
    const q = new URLSearchParams(window.location.search).get("room");
    if (q && /^[a-z0-9-]{1,40}$/.test(q)) {
      window.localStorage.setItem(ROOM_KEY, q);
      return q;
    }
    const saved = window.localStorage.getItem(ROOM_KEY);
    if (saved && /^[a-z0-9-]{1,40}$/.test(saved)) return saved;
  } catch {
    /* fall through */
  }
  return config.demoRoom;
}

let cached: Repo | undefined;

function serverRepo(): Repo {
  // No browser storage on the server. A fresh in memory copy of the seed, enough to render real HTML.
  return createRepo({ mode: config.mode, backend: new MemoryBackend(), seed: buildSeed, auth: createMemoryAuth(null), storage: createMemoryStorage(), latency: null });
}

/** The one place that picks an adapter. Components never call this directly, they use hooks. */
export function getRepo(): Repo {
  if (typeof window === "undefined") return serverRepo();
  if (cached) return cached;
  if (config.mode === "live") {
    cached = createNeonRepo();
  } else if (config.mode === "demo") {
    cached = createRepo({ mode: "demo", backend: new RemoteBackend(currentRoom), seed: buildSeed, auth: createCookieAuth(), storage: createIndexedDbStorage(), latency: null, tick: true });
  } else {
    cached = createRepo({ mode: "mock", backend: new LocalBackend(STORE_KEY), seed: buildSeed, auth: createCookieAuth(), storage: createIndexedDbStorage(), latency: config.latency, tick: true });
  }
  return cached;
}
