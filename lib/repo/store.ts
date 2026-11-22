import { StoreDocSchema, type StoreDoc } from "@/lib/domain/schemas";
import type { DocBackend } from "./backends";

export function parseDoc(raw: string | null): StoreDoc | null {
  if (!raw) return null;
  try {
    const r = StoreDocSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/**
 * A fast check used when reading. The full Zod parse runs before every write, so bad data can never be saved,
 * and a document that fails the quick check is replaced with the seed. Skipping Zod on read keeps the page quick to start.
 */
export function quickParse(raw: string | null): StoreDoc | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<StoreDoc> | null;
    if (!d || d.version !== 1 || !Array.isArray(d.rates) || !Array.isArray(d.pieces) || !Array.isArray(d.reservations) || !Array.isArray(d.ledger) || !d.settings || !d.counters || !d.accountant) return null;
    return d as StoreDoc;
  } catch {
    return null;
  }
}

/** Holds the latest document in memory, runs transactions through the backend and tells listeners when anything changes. */
export class Store {
  private doc: StoreDoc | null = null;
  private initP: Promise<{ recovered: boolean }> | null = null;
  private listeners = new Set<() => void>();
  private off: (() => void) | null = null;
  readonly origin = {};

  constructor(
    private readonly backend: DocBackend,
    private readonly seed: () => StoreDoc,
  ) {}

  ready(): Promise<{ recovered: boolean }> {
    if (!this.initP) {
      this.initP = (async () => {
        const raw = await this.backend.load();
        let doc = quickParse(raw);
        let recovered = false;
        if (!doc) {
          // Nothing stored, an old version, or corrupt data. Reseed through a transaction so another tab does not race us.
          recovered = raw !== null;
          const next = await this.backend.transact((cur) => (quickParse(cur) ? (cur as string) : JSON.stringify(this.seed())), this.origin);
          doc = quickParse(next);
        }
        this.doc = doc;
        this.off = this.backend.onExternalChange(() => void this.reload(), this.origin);
        return { recovered };
      })();
    }
    return this.initP;
  }

  get(): StoreDoc {
    if (!this.doc) throw new Error("Store is not ready");
    return this.doc;
  }

  private async reload() {
    const doc = quickParse(await this.backend.load());
    if (doc) {
      this.doc = doc;
      this.notify();
    }
  }

  async transact<T>(fn: (doc: StoreDoc) => T): Promise<T> {
    await this.ready();
    let result!: T;
    let final: StoreDoc | null = null;
    await this.backend.transact((raw) => {
      const doc = parseDoc(raw) ?? this.seed();
      result = fn(doc);
      const check = StoreDocSchema.safeParse(doc);
      if (!check.success) throw new Error(`Refusing to save an invalid document: ${check.error.issues[0]?.path.join(".")} ${check.error.issues[0]?.message}`);
      final = doc;
      return JSON.stringify(doc);
    }, this.origin);
    this.doc = final;
    this.notify();
    return result;
  }

  async reset(): Promise<void> {
    await this.ready();
    const fresh = this.seed();
    await this.backend.transact(() => JSON.stringify(fresh), this.origin);
    this.doc = fresh;
    this.notify();
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }

  notify() {
    for (const l of [...this.listeners]) l();
  }

  dispose() {
    this.off?.();
  }
}
