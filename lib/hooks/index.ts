"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { messageOf } from "@/lib/domain/errors";
import type { AccountantSettings, AuditEntry, Expense, Job, LayawayPlan, LedgerEntry, OldGoldPurchase, Piece, Rate, Reservation, SendLog, SentMessage, Session, Settings, ValuationRequest, VisitRequest } from "@/lib/domain/schemas";
import { buildSeed } from "@/lib/mock/seed";
import { getRepo, type Repo } from "@/lib/repo";
import type { Period } from "@/lib/time";

/** The one way screens reach data. Hooks call the repo, components never do. */
export const repo = (): Repo => getRepo();

export interface Query<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

let seedCache: ReturnType<typeof buildSeed> | null = null;
/** What the server renders before the browser store is loaded. Deterministic enough for hydration. */
export function seedInitial() {
  if (!seedCache) seedCache = buildSeed(new Date());
  return seedCache;
}

export function useQuery<T>(fn: (r: Repo) => Promise<T>, deps: readonly unknown[], initial?: T): Query<T> {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: string | null }>({ data: initial, loading: initial === undefined, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const r = getRepo();
    const go = async () => {
      const id = ++run.current;
      try {
        const d = await fnRef.current(r);
        if (alive && id === run.current) setState({ data: d, loading: false, error: null });
      } catch (e) {
        if (alive && id === run.current) setState((s) => ({ data: s.data, loading: false, error: messageOf(e) }));
      }
    };
    r.ready().then(go, (e) => alive && setState((s) => ({ ...s, loading: false, error: messageOf(e) })));
    const off = r.subscribe(go);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, refresh };
}

/* Public data. These start from the seed so the first paint has real prices. */

export const useRate = () => useQuery<Rate>((r) => r.rates.current(), [], seedInitial().rates.at(-1));
export const useRateHistory = (n = 7) => useQuery<Rate[]>((r) => r.rates.history(n), [n]);
export const useSettings = () => useQuery<Settings>((r) => r.settings.get(), [], seedInitial().settings);
export const usePieces = () => useQuery<Piece[]>((r) => r.pieces.list(), [], seedInitial().pieces.filter((p) => p.visible));
export const usePiece = (slug: string) => {
  const seed = useMemo(() => seedInitial().pieces.find((p) => p.slug === slug && p.visible), [slug]);
  return useQuery<Piece | null>((r) => r.pieces.bySlug(slug), [slug], seed ?? undefined);
};
export const useSlotLoad = (date: string) => useQuery<Record<string, number>>((r) => r.visits.slotLoad(date), [date]);

/* Admin data. */

export const useAllPieces = () => useQuery<Piece[]>((r) => r.pieces.list({ includeHidden: true }), []);
export const useReservations = () => useQuery<Reservation[]>((r) => r.reservations.list(), []);
export const useJobs = () => useQuery<Job[]>((r) => r.jobs.list(), []);
export const useOldGold = () => useQuery<OldGoldPurchase[]>((r) => r.oldGold.list(), []);
export const useLayaway = () => useQuery<LayawayPlan[]>((r) => r.layaway.list(), []);
export const useVisits = () => useQuery<VisitRequest[]>((r) => r.visits.listVisits(), []);
export const useValuations = () => useQuery<ValuationRequest[]>((r) => r.visits.listValuations(), []);
export const useLedger = (p: Pick<Period, "from" | "to">) => useQuery<LedgerEntry[]>((r) => r.books.ledger(p), [p.from, p.to]);
export const useExpenses = (p: Pick<Period, "from" | "to">) => useQuery<Expense[]>((r) => r.books.expenses(p), [p.from, p.to]);
export const useAudit = () => useQuery<AuditEntry[]>((r) => r.audit.list(200), []);
export const useSent = () => useQuery<SentMessage[]>((r) => r.ports.notify.list(200), []);
export const useAccountant = () => useQuery<AccountantSettings>((r) => r.ports.accountant.settings(), []);
export const useSendHistory = () => useQuery<SendLog[]>((r) => r.ports.accountant.history(), []);

/** A reservation by code and the last four digits, for the customer's confirmation page. Updates when staff change the status. */
export const useReservationLookup = (code: string, last4: string) => useQuery<Reservation | null>((r) => (last4.length === 4 ? r.reservations.lookup(code, last4) : Promise.resolve(null)), [code, last4]);

/* Session. */

const noSession = () => null;
export function useSession(): Session | null {
  const sub = useCallback((cb: () => void) => getRepo().ports.auth.subscribe(cb), []);
  return useSyncExternalStore(sub, () => getRepo().ports.auth.current(), noSession);
}

/** False on the server and during hydration, true afterwards. Use it to hide anything that depends on the visitor's clock. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const subNone = () => () => {};
/** ?review=1 shows the [confirm] markers on facts that still need the owner's OK. */
export function useReviewMode(): boolean {
  return useSyncExternalStore(
    subNone,
    () => new URLSearchParams(window.location.search).get("review") === "1",
    () => false,
  );
}

/** Turns an image reference into a URL. Bundled photos are plain paths, uploaded ones live in browser storage. */
export function useImageUrl(ref: string): string | null {
  const isFile = ref.startsWith("idb:") || ref.startsWith("mem:");
  const [url, setUrl] = useState<string | null>(isFile ? null : ref);
  useEffect(() => {
    if (!isFile) {
      setUrl(ref);
      return;
    }
    let alive = true;
    getRepo().ports.storage.url(ref).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [ref, isFile]);
  return url;
}
