import type {
  AccountantSettings, AuditEntry, ExportFormat, Expense, Job, LayawayPlan, LedgerEntry, NewExpenseInput, NewJobInput, NewLayawayInput, NewOldGoldInput, NewPieceInput,
  OldGoldPurchase, Piece, Rate, Reservation, ReserveInput, SendLog, SentMessage, Session, Settings, ValuationInput, ValuationRequest, VisitInput, VisitRequest, Role,
} from "@/lib/domain/schemas";
import type { Period } from "@/lib/time";

/**
 * Every adapter (mock, demo, neon) implements these interfaces. Screens only ever see them through hooks.
 * A contract test suite (lib/repo/contract) runs against each adapter.
 */

export interface RatesRepo {
  current(): Promise<Rate>;
  history(limit?: number): Promise<Rate[]>;
  /** Owner only. Logs who and when. */
  publish(rate24Cents: number): Promise<Rate>;
}

export interface PiecesRepo {
  /** Public callers get visible pieces only. includeHidden needs a signed in session. */
  list(opts?: { includeHidden?: boolean }): Promise<Piece[]>;
  bySlug(slug: string): Promise<Piece | null>;
  add(input: NewPieceInput): Promise<Piece>;
  update(id: string, patch: Partial<Pick<Piece, "visible" | "image" | "name" | "description" | "certificateRef" | "units">>): Promise<Piece>;
  sellAtCounter(id: string, input: { customer: string; qty?: number }): Promise<LedgerEntry[]>;
}

export interface ReservationsRepo {
  create(input: ReserveInput): Promise<Reservation>;
  /** Staff and owner. */
  list(): Promise<Reservation[]>;
  /** Public: needs the code and the last four digits of the phone. */
  lookup(code: string, phoneLast4: string): Promise<Reservation | null>;
  markReady(id: string): Promise<Reservation>;
  markSold(id: string): Promise<Reservation>;
  release(id: string): Promise<Reservation>;
  /** Moves overdue holds to expired and frees the pieces. Returns how many. */
  expireDue(): Promise<number>;
}

export interface JobsRepo {
  list(): Promise<Job[]>;
  add(input: NewJobInput): Promise<Job>;
  advance(id: string): Promise<Job>;
  /** Hand over and take the balance. Writes a ledger row and closes the ticket. */
  collectBalance(id: string): Promise<Job>;
}

export interface OldGoldRepo {
  /** idRef is always masked here. */
  list(): Promise<OldGoldPurchase[]>;
  add(input: NewOldGoldInput): Promise<OldGoldPurchase>;
  markMelted(id: string): Promise<OldGoldPurchase>;
  /** Owner only. Writes an audit row. */
  revealId(id: string): Promise<string>;
}

export interface LayawayRepo {
  list(): Promise<LayawayPlan[]>;
  add(input: NewLayawayInput): Promise<LayawayPlan>;
  recordPayment(id: string, amountCents?: number): Promise<LayawayPlan>;
}

export interface BooksRepo {
  periods(): Period[];
  ledger(period: Pick<Period, "from" | "to">): Promise<LedgerEntry[]>;
  expenses(period: Pick<Period, "from" | "to">): Promise<Expense[]>;
  addExpense(input: NewExpenseInput): Promise<Expense>;
  /** Writes an audit row for every export. */
  logExport(kind: string, period: Period): Promise<void>;
}

export interface SettingsRepo {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
}

export interface VisitsRepo {
  addVisit(input: VisitInput): Promise<VisitRequest>;
  addValuation(input: ValuationInput): Promise<ValuationRequest>;
  listVisits(): Promise<VisitRequest[]>;
  listValuations(): Promise<ValuationRequest[]>;
  setVisitStatus(id: string, status: VisitRequest["status"]): Promise<void>;
  setValuationStatus(id: string, status: ValuationRequest["status"]): Promise<void>;
  /** Public: how many visits are already booked in each window on a date, keyed by window start ISO. */
  slotLoad(date: string): Promise<Record<string, number>>;
}

export interface AuditRepo {
  list(limit?: number): Promise<AuditEntry[]>;
}

/* Ports */

export interface AuthPort {
  current(): Session | null;
  signIn(role: Role): Session;
  signOut(): void;
  subscribe(cb: () => void): () => void;
}

export interface PaymentPort {
  /** Version 1 is pay at the store. Online deposits come later through Stripe Checkout. */
  readonly mode: "pay_at_store";
  charge(): Promise<never>;
}

export interface NotifyPort {
  list(limit?: number): Promise<SentMessage[]>;
}

export interface StoragePort {
  put(file: Blob, kind: "invoice" | "piece"): Promise<string>;
  url(ref: string): Promise<string | null>;
}

export interface AccountantPort {
  settings(): Promise<AccountantSettings>;
  update(patch: Partial<AccountantSettings>): Promise<AccountantSettings>;
  history(): Promise<SendLog[]>;
  /** Owner only. Mock writes to the Sent log. Live emails a zip. */
  send(period: Period, format: ExportFormat): Promise<SendLog>;
}

export interface RateFeedSuggestion {
  rate24Cents: number;
  source: string;
  asOf: string;
}

export interface RateFeedPort {
  /** Suggests a morning rate for the owner to approve. Never publishes by itself. */
  suggest(currentCents: number): Promise<RateFeedSuggestion>;
}

export type AppMode = "mock" | "demo" | "live";

export interface Repo {
  mode: AppMode;
  /** Resolves once the store is loaded. */
  ready(): Promise<{ recovered: boolean }>;
  subscribe(cb: () => void): () => void;
  rates: RatesRepo;
  pieces: PiecesRepo;
  reservations: ReservationsRepo;
  jobs: JobsRepo;
  oldGold: OldGoldRepo;
  layaway: LayawayRepo;
  books: BooksRepo;
  settings: SettingsRepo;
  visits: VisitsRepo;
  audit: AuditRepo;
  ports: { auth: AuthPort; payment: PaymentPort; notify: NotifyPort; storage: StoragePort; accountant: AccountantPort; rateFeed: RateFeedPort };
  /** Reseed everything. Demo data only. */
  reset(): Promise<void>;
}
