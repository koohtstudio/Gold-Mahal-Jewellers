import { SESSION_COOKIE } from "@/lib/config";
import type { Role, Session } from "@/lib/domain/schemas";
import type { AuthPort, PaymentPort, RateFeedPort, StoragePort } from "./types";

const EMAILS: Record<Role, string> = { owner: "owner@demo.test", staff: "staff@demo.test" };

function makeSession(role: Role): Session {
  return { role, email: EMAILS[role] };
}

/** Demo login. The session is one cookie that holds only the role name. Real sign in replaces this with Neon Auth. */
export function createCookieAuth(): AuthPort {
  const listeners = new Set<() => void>();
  let lastRaw: string | null = null;
  let lastSession: Session | null = null;
  const read = (): Session | null => {
    if (typeof document === "undefined") return null;
    const m = document.cookie.split("; ").find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    const v = m?.slice(SESSION_COOKIE.length + 1) ?? null;
    if (v === lastRaw) return lastSession;
    lastRaw = v;
    lastSession = v === "owner" || v === "staff" ? makeSession(v) : null;
    return lastSession;
  };
  const notify = () => listeners.forEach((l) => l());
  return {
    current: read,
    signIn(role) {
      document.cookie = `${SESSION_COOKIE}=${role}; path=/; max-age=${60 * 60 * 8}; samesite=lax`;
      notify();
      return read() as Session;
    },
    signOut() {
      document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
      notify();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
  };
}

/** For tests and server rendering. */
export function createMemoryAuth(initial: Role | null = null): AuthPort & { set(role: Role | null): void } {
  let session: Session | null = initial ? makeSession(initial) : null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  return {
    current: () => session,
    signIn(role) {
      session = makeSession(role);
      notify();
      return session;
    },
    signOut() {
      session = null;
      notify();
    },
    set(role) {
      session = role ? makeSession(role) : null;
      notify();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
  };
}

export const payAtStore: PaymentPort = {
  mode: "pay_at_store",
  async charge() {
    throw new Error("Online payment is not part of version 1. Customers pay at the store.");
  },
};

/** A drifting sample. Not market data. The owner approves it or ignores it. */
export const sampleRateFeed: RateFeedPort = {
  async suggest(currentCents) {
    const d = new Date();
    const seed = d.getUTCFullYear() * 400 + d.getUTCMonth() * 31 + d.getUTCDate();
    const drift = (((seed * 9301 + 49297) % 233280) / 233280 - 0.45) * 0.03; // about -1.4% to +1.6%
    const rate = Math.max(5000, Math.round((currentCents * (1 + drift)) / 50) * 50);
    return { rate24Cents: rate, source: "Sample feed (not real market data)", asOf: d.toISOString() };
  },
};

/** Files in memory. Server render and tests. */
export function createMemoryStorage(): StoragePort {
  const files = new Map<string, string>();
  return {
    async put(file, kind) {
      const ref = `mem:${kind}-${files.size + 1}`;
      files.set(ref, `data:${file.type};size=${file.size}`);
      return ref;
    },
    async url(ref) {
      return files.get(ref) ?? null;
    },
  };
}

/** Files in IndexedDB, shown through blob URLs. Photos stay on this device until the live storage adapter exists. */
export function createIndexedDbStorage(): StoragePort {
  const DB = "gm-files";
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const cache = new Map<string, string>();
  return {
    async put(file, kind) {
      const ref = `idb:${kind}-${crypto.randomUUID()}`;
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(file, ref);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return ref;
    },
    async url(ref) {
      if (cache.has(ref)) return cache.get(ref) ?? null;
      try {
        const db = await open();
        const blob = await new Promise<Blob | undefined>((resolve, reject) => {
          const req = db.transaction("files").objectStore("files").get(ref);
          req.onsuccess = () => resolve(req.result as Blob | undefined);
          req.onerror = () => reject(req.error);
        });
        if (!blob) return null;
        const u = URL.createObjectURL(blob);
        cache.set(ref, u);
        return u;
      } catch {
        return null;
      }
    },
  };
}
