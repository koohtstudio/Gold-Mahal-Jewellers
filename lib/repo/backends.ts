/**
 * Where the one JSON document lives. The Store does the parsing and the domain logic, a backend only moves strings
 * and makes read-modify-write atomic.
 */
export interface DocBackend {
  load(): Promise<string | null>;
  /** fn gets the current raw document (or null) and returns the next one. It may run more than once on a conflict. It may throw to abort. */
  transact(fn: (raw: string | null) => string, origin: object): Promise<string>;
  /** Called when something other than `origin` changed the document. */
  onExternalChange(cb: () => void, origin: object): () => void;
}

/** Shared, in process. Used by tests and by the server render, where there is no browser storage. */
export class MemoryBackend implements DocBackend {
  private raw: string | null = null;
  private subs = new Set<{ cb: () => void; origin: object }>();
  async load() {
    return this.raw;
  }
  async transact(fn: (raw: string | null) => string, origin: object) {
    const next = fn(this.raw);
    this.raw = next;
    for (const s of this.subs) if (s.origin !== origin) s.cb();
    return next;
  }
  onExternalChange(cb: () => void, origin: object) {
    const sub = { cb, origin };
    this.subs.add(sub);
    return () => void this.subs.delete(sub);
  }
}

/** localStorage plus BroadcastChannel. Writes are serialised across tabs with the Web Locks API when it exists. */
export class LocalBackend implements DocBackend {
  private fallback: string | null = null;
  private channel: BroadcastChannel | null = null;
  constructor(
    private readonly key: string,
    private readonly channelName = "gm-mock",
  ) {
    try {
      this.channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName) : null;
    } catch {
      this.channel = null;
    }
  }
  private get(): string | null {
    try {
      return window.localStorage.getItem(this.key) ?? this.fallback;
    } catch {
      return this.fallback;
    }
  }
  private set(v: string) {
    try {
      window.localStorage.setItem(this.key, v);
      this.fallback = null;
    } catch {
      // Private mode or storage full: keep working for this tab with an in memory copy.
      this.fallback = v;
    }
  }
  async load() {
    return this.get();
  }
  async transact(fn: (raw: string | null) => string) {
    const run = () => {
      const next = fn(this.get());
      this.set(next);
      try {
        this.channel?.postMessage("changed");
      } catch {
        /* ignore */
      }
      return next;
    };
    const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    return locks ? await locks.request(`${this.key}-lock`, async () => run()) : run();
  }
  onExternalChange(cb: () => void) {
    const onMsg = () => cb();
    const onStorage = (e: StorageEvent) => {
      if (e.key === this.key || e.key === null) cb();
    };
    this.channel?.addEventListener("message", onMsg);
    window.addEventListener("storage", onStorage);
    return () => {
      this.channel?.removeEventListener("message", onMsg);
      window.removeEventListener("storage", onStorage);
    };
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Demo mode. The same document, kept in one Neon row per room and shared by every device.
 * Writes use optimistic concurrency (expectedVersion). Other devices notice by polling.
 */
export class RemoteBackend implements DocBackend {
  private version = 0;
  private raw: string | null = null;
  private channel: BroadcastChannel | null = null;
  constructor(
    private readonly room: () => string,
    private readonly doFetch: FetchLike = (i, init) => fetch(i, init),
    private readonly pollMs = 1200,
  ) {
    try {
      this.channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gm-demo") : null;
    } catch {
      this.channel = null;
    }
  }
  private url(extra = "") {
    return `/api/demo/doc?room=${encodeURIComponent(this.room())}${extra}`;
  }
  private async pull(): Promise<boolean> {
    const res = await this.doFetch(this.url(`&since=${this.version}`), { cache: "no-store" });
    if (!res.ok) throw new Error("The demo database is not reachable right now.");
    const j = (await res.json()) as { changed: boolean; version: number; data: unknown | null };
    if (!j.changed) return false;
    this.version = j.version;
    this.raw = j.data === null ? null : JSON.stringify(j.data);
    return true;
  }
  async load() {
    this.version = 0;
    await this.pull();
    return this.raw;
  }
  async transact(fn: (raw: string | null) => string) {
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt === 0) await this.pull().catch(() => false);
      const next = fn(this.raw);
      const res = await this.doFetch(this.url(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: this.version, data: JSON.parse(next) }) });
      if (res.status === 409) {
        const j = (await res.json()) as { version: number; data: unknown | null };
        this.version = j.version;
        this.raw = j.data === null ? null : JSON.stringify(j.data);
        continue;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "The demo database did not accept that change.");
      }
      const j = (await res.json()) as { version: number };
      this.version = j.version;
      this.raw = next;
      try {
        this.channel?.postMessage("changed");
      } catch {
        /* ignore */
      }
      return next;
    }
    throw new Error("Several people are changing the demo at once. Please try again.");
  }
  onExternalChange(cb: () => void) {
    const onMsg = () => {
      this.pull().then((c) => c && cb(), () => {});
    };
    this.channel?.addEventListener("message", onMsg);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stopped) return;
      try {
        if (await this.pull()) cb();
      } catch {
        /* offline: try again next time */
      }
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      timer = setTimeout(tick, hidden ? this.pollMs * 4 : this.pollMs);
    };
    timer = setTimeout(tick, this.pollMs);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      this.channel?.removeEventListener("message", onMsg);
    };
  }
}
