import { DomainError } from "@/lib/domain/errors";
import type { Settings, StoreDoc } from "@/lib/domain/schemas";
import { RateLimiter, judgeSubmission, lastFour } from "@/lib/guards";
import { inPeriod, periodsFor } from "@/lib/time";
import type { z } from "zod";
import type { DocBackend } from "./backends";
import * as ops from "./ops";
import { payAtStore, sampleRateFeed } from "./ports";
import { Store } from "./store";
import type { AccountantPort, AppMode, AuthPort, Repo, StoragePort } from "./types";

export interface CreateRepoOptions {
  mode: AppMode;
  backend: DocBackend;
  seed: (now: Date) => StoreDoc;
  auth: AuthPort;
  storage: StoragePort;
  /** Simulated latency in ms [min, max], or null for none. */
  latency: [number, number] | null;
  now?: () => Date;
  random?: () => number;
  /** Run the hold expiry check on a timer. Browsers only. */
  tick?: boolean;
}

type SchemaMod = typeof import("@/lib/domain/schemas");
let schemaMod: Promise<SchemaMod> | null = null;

/** Zod is loaded on the first write, not when the page starts. */
async function check<S extends z.ZodType>(pick: (m: SchemaMod) => S, input: unknown): Promise<z.infer<S>> {
  const m = await (schemaMod ??= import("@/lib/domain/schemas"));
  const r = pick(m).safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue && issue.path.length ? ` (${issue.path.join(".")})` : "";
    throw new DomainError("validation", `${issue?.message ?? "That does not look right."}${where}`);
  }
  return r.data;
}

export function createRepo(o: CreateRepoOptions): Repo {
  const now = o.now ?? (() => new Date());
  const random = o.random ?? Math.random;
  const store = new Store(o.backend, () => o.seed(now()));
  const reserveLimit = new RateLimiter(6, 10 * 60_000);
  const lookupLimit = new RateLimiter(12, 5 * 60_000);
  const requestLimit = new RateLimiter(8, 10 * 60_000);
  const ctx = (): ops.Ctx => ({ now: now(), session: o.auth.current(), random });

  const delay = () => (o.latency ? new Promise<void>((r) => setTimeout(r, o.latency![0] + Math.random() * (o.latency![1] - o.latency![0]))) : Promise.resolve());
  const read = async <T>(fn: (doc: StoreDoc, c: ops.Ctx) => T): Promise<T> => {
    await store.ready();
    return fn(store.get(), ctx());
  };
  const write = async <T>(fn: (doc: StoreDoc, c: ops.Ctx) => T): Promise<T> => {
    await store.ready();
    await delay();
    const c = ctx();
    return store.transact((doc) => fn(doc, c));
  };
  const guard = (limit: RateLimiter, hp: string | undefined, t: number | undefined) => {
    const verdict = judgeSubmission({ honeypot: hp, elapsedMs: t });
    if (verdict === "too_fast") throw new DomainError("too_fast", "That was quick. Please check your details and send again.");
    if (verdict === "spam") return false;
    if (!limit.take("session")) throw new DomainError("rate_limited", "Too many tries. Please wait a few minutes or call the store.");
    return true;
  };

  let tickTimer: ReturnType<typeof setInterval> | undefined;
  const startTick = () => {
    if (!o.tick || tickTimer) return;
    const run = async () => {
      try {
        await store.ready();
        if (ops.maintenanceDue(store.get(), now())) await store.transact((doc) => ops.expireDue(doc, { now: now(), session: null, random }));
      } catch {
        /* the next tick tries again */
      }
    };
    void run();
    tickTimer = setInterval(run, 30_000);
  };

  const accountant: AccountantPort = {
    settings: () => read((d, c) => (ops.requireOwner(c), d.accountant)),
    async update(patch) {
      const v = await check((m) => m.AccountantSettingsSchema.partial().strict(), patch);
      return write((d, c) => {
        ops.requireOwner(c);
        d.accountant = { ...d.accountant, ...v };
        ops.audit(d, c, "accountant.update", d.accountant.email);
        return d.accountant;
      });
    },
    history: () => read((d, c) => (ops.requireOwner(c), d.sendLog)),
    send: (period, format) => write((d, c) => ops.sendToAccountant(d, c, period, format)),
  };

  const repo: Repo = {
    mode: o.mode,
    async ready() {
      const r = await store.ready();
      await delay();
      startTick();
      return r;
    },
    subscribe(cb) {
      const a = store.subscribe(cb);
      const b = o.auth.subscribe(cb);
      return () => {
        a();
        b();
      };
    },
    rates: {
      current: () => read((d) => ops.currentRate(d)),
      history: (limit = 7) => read((d) => [...d.rates].sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : 1)).slice(-limit)),
      publish: (cents) => write((d, c) => ops.publishRate(d, c, cents)),
    },
    pieces: {
      list: (opts) =>
        read((d, c) => {
          if (opts?.includeHidden) ops.requireStaff(c);
          return opts?.includeHidden ? d.pieces : d.pieces.filter((p) => p.visible);
        }),
      bySlug: (slug) => read((d, c) => d.pieces.find((p) => p.slug === slug && (p.visible || c.session)) ?? null),
      async add(input) {
        const v = await check((m) => m.NewPieceInputSchema, input);
        return write((d, c) => ops.addPiece(d, c, v));
      },
      update: (id, patch) => write((d, c) => ops.updatePiece(d, c, id, patch)),
      sellAtCounter: (id, input) => write((d, c) => ops.sellAtCounter(d, c, id, input)),
    },
    reservations: {
      async create(raw) {
        const input = await check((m) => m.ReserveInputSchema, raw);
        const { _hp, _t, ...clean } = input;
        if (!guard(reserveLimit, _hp, _t)) {
          // A bot filled the hidden field. Pretend it worked, store nothing.
          const t = now().toISOString();
          return { id: "R-0", code: "GM-0000", customer: clean.name, phone: clean.phone, lines: [], lockedRate24Cents: 1, subtotalCents: 0, hstCents: 0, totalCents: 0, visitAt: t, visitEndAt: t, visitLabel: "", holdUntil: t, status: "released", createdAt: t } as never;
        }
        return write((d, c) => ops.createReservation(d, c, clean));
      },
      list: () =>
        read((d, c) => {
          ops.requireStaff(c);
          return d.reservations.map((r) => ops.viewReservation(d, r)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        }),
      async lookup(code, last4) {
        if (!lookupLimit.take("session")) throw new DomainError("rate_limited", "Too many tries. Please wait a few minutes or call the store.");
        return read((d) => {
          const r = d.reservations.find((x) => x.code === code.trim().toUpperCase() && lastFour(x.phone) === last4.replace(/\D/g, ""));
          return r ? ops.viewReservation(d, r) : null;
        });
      },
      markReady: (id) => write((d, c) => ops.markReady(d, c, id)),
      markSold: (id) => write((d, c) => ops.markSold(d, c, id)),
      release: (id) => write((d, c) => ops.releaseReservation(d, c, id)),
      expireDue: () => write((d, c) => ops.expireDue(d, c)),
    },
    jobs: {
      list: () => read((d, c) => (ops.requireStaff(c), d.jobs)),
      async add(input) {
        const v = await check((m) => m.NewJobInputSchema, input);
        return write((d, c) => ops.addJob(d, c, v));
      },
      advance: (id) => write((d, c) => ops.advanceJob(d, c, id)),
      collectBalance: (id) => write((d, c) => ops.collectBalance(d, c, id)),
    },
    oldGold: {
      list: () => read((d, c) => (ops.requireStaff(c), d.oldGold.map(ops.maskOldGold))),
      async add(input) {
        const v = await check((m) => m.NewOldGoldInputSchema, input);
        return write((d, c) => ops.maskOldGold(ops.addOldGold(d, c, v)));
      },
      markMelted: (id) => write((d, c) => ops.maskOldGold(ops.markMelted(d, c, id))),
      revealId: (id) => write((d, c) => ops.revealOldGoldId(d, c, id)),
    },
    layaway: {
      list: () => read((d, c) => (ops.requireStaff(c), d.layaway)),
      async add(input) {
        const v = await check((m) => m.NewLayawayInputSchema, input);
        return write((d, c) => ops.addLayaway(d, c, v));
      },
      recordPayment: (id, amt) => write((d, c) => ops.recordLayawayPayment(d, c, id, amt)),
    },
    books: {
      periods: () => periodsFor(now()),
      ledger: (p) => read((d, c) => (ops.requireOwner(c), d.ledger.filter((e) => inPeriod(e.date, p)))),
      expenses: (p) => read((d, c) => (ops.requireOwner(c), d.expenses.filter((e) => inPeriod(e.date, p)))),
      async addExpense(input) {
        const v = await check((m) => m.NewExpenseInputSchema, input);
        return write((d, c) => ops.addExpense(d, c, v));
      },
      logExport: (kind, period) => write((d, c) => ops.logExport(d, c, kind, period)),
    },
    settings: {
      get: () => read((d) => d.settings),
      async update(patch) {
        const v = await check((m) => m.SettingsSchema.partial().strict(), patch);
        return write((d, c) => ops.updateSettings(d, c, v as Partial<Settings>));
      },
    },
    visits: {
      async addVisit(raw) {
        const input = await check((m) => m.VisitInputSchema, raw);
        const { _hp, _t, ...clean } = input;
        if (!guard(requestLimit, _hp, _t)) return { id: "vr-0", createdAt: now().toISOString(), type: clean.type, preferredDate: clean.preferredDate, name: clean.name, phone: clean.phone, status: "new" };
        return write((d, c) => ops.addVisit(d, c, clean));
      },
      async addValuation(raw) {
        const input = await check((m) => m.ValuationInputSchema, raw);
        const { _hp, _t, ...clean } = input;
        if (!guard(requestLimit, _hp, _t)) return { id: "val-0", createdAt: now().toISOString(), karat: clean.karat, gramsMilli: clean.gramsMilli, estimateCents: 0, name: clean.name, phone: clean.phone, preferredDate: clean.preferredDate, status: "new" };
        return write((d, c) => ops.addValuation(d, c, clean));
      },
      listVisits: () => read((d, c) => (ops.requireStaff(c), d.visits)),
      listValuations: () => read((d, c) => (ops.requireStaff(c), d.valuations)),
      setVisitStatus: (id, s) => write((d, c) => ops.setRequestStatus(d, c, "visit", id, s)),
      setValuationStatus: (id, s) => write((d, c) => ops.setRequestStatus(d, c, "valuation", id, s)),
      slotLoad: (date) => read((d) => ops.slotLoad(d, date)),
    },
    audit: { list: (limit = 100) => read((d, c) => (ops.requireOwner(c), d.audit.slice(0, limit))) },
    ports: {
      auth: o.auth,
      payment: payAtStore,
      notify: { list: (limit = 100) => read((d, c) => (ops.requireOwner(c), d.sent.slice(0, limit))) },
      storage: o.storage,
      accountant,
      rateFeed: sampleRateFeed,
    },
    async reset() {
      await delay();
      await store.reset();
    },
  };
  return repo;
}

