import { z } from "zod";

/** Domain types and Zod schemas. Money is integer cents. Weight is integer milligrams. Rates in cents per gram. */

export const KARATS = [24, 22, 18, 14] as const;
export const KaratSchema = z.union([z.literal(24), z.literal(22), z.literal(18), z.literal(14)]);
export type Karat = z.infer<typeof KaratSchema>;

export const CATEGORIES = ["Earrings", "Chains", "Bridal", "Diamonds", "Bars"] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

const cents = z.number().int().min(0);
const text = (max = 200) => z.string().trim().min(1).max(max);
const isoDateTime = z.string().min(10).max(40);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const RateSchema = z.object({
  id: z.string(),
  publishedAt: isoDateTime,
  rate24Cents: z.number().int().positive(),
  publishedBy: z.string(),
});
export type Rate = z.infer<typeof RateSchema>;

export const PieceSchema = z.object({
  id: z.string(),
  tag: z.string(),
  slug: z.string(),
  name: text(120),
  category: CategorySchema,
  /** null for fixed price pieces (for example moissanite in sterling silver). */
  karat: KaratSchema.nullable(),
  netGramsMilli: z.number().int().min(0),
  makingBps: z.number().int().min(0).max(10000),
  stoneCents: cents,
  fixedCents: cents.optional(),
  units: z.number().int().min(0),
  unitsReserved: z.number().int().min(0),
  unitsSold: z.number().int().min(0),
  visible: z.boolean(),
  certificateRef: z.string().max(80).optional(),
  taxFree: z.boolean(),
  image: z.string().max(200),
  description: z.string().max(400),
  optionLabel: z.string().max(40),
  options: z.array(z.string().max(30)).max(12),
  badge: z.string().max(30).optional(),
  createdAt: isoDateTime,
});
export type Piece = z.infer<typeof PieceSchema>;
export type PieceStatus = "in_case" | "reserved" | "sold";

export const ReservationLineSchema = z.object({
  pieceId: z.string(),
  name: z.string(),
  option: z.string(),
  qty: z.number().int().min(1).max(20),
  unitCents: cents,
  taxFree: z.boolean(),
  image: z.string(),
});
export type ReservationLine = z.infer<typeof ReservationLineSchema>;

export const ReservationStatusSchema = z.enum(["new", "ready", "sold", "released", "expired"]);
export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

export const ReservationSchema = z.object({
  id: z.string(),
  code: z.string().regex(/^GM-\d{4}$/),
  customer: z.string(),
  phone: z.string(),
  lines: z.array(ReservationLineSchema).min(1),
  lockedRate24Cents: z.number().int().positive(),
  subtotalCents: cents,
  hstCents: cents,
  totalCents: cents,
  visitAt: isoDateTime,
  visitEndAt: isoDateTime,
  visitLabel: z.string(),
  holdUntil: isoDateTime,
  status: ReservationStatusSchema,
  createdAt: isoDateTime,
  readyAt: isoDateTime.optional(),
  soldAt: isoDateTime.optional(),
  releasedAt: isoDateTime.optional(),
  noticeAt: isoDateTime.optional(),
});
export type Reservation = z.infer<typeof ReservationSchema>;

export const JobTypeSchema = z.enum(["custom", "repair", "resize"]);
export const JobStageSchema = z.enum(["intake", "workshop", "ready"]);
export const JobSchema = z.object({
  id: z.string(),
  ticket: z.string(),
  customer: z.string(),
  phone: z.string().optional(),
  type: JobTypeSchema,
  title: z.string(),
  quoteCents: cents,
  depositCents: cents,
  dueDate: isoDate,
  stage: JobStageSchema,
  createdAt: isoDateTime,
  textedAt: isoDateTime.optional(),
  closedAt: isoDateTime.optional(),
});
export type Job = z.infer<typeof JobSchema>;

export const OldGoldPurchaseSchema = z.object({
  id: z.string(),
  date: isoDate,
  customer: z.string(),
  karat: KaratSchema,
  gramsMilli: z.number().int().positive(),
  pureGramsMilli: z.number().int().positive(),
  /** Buy rate per pure gram at the time, in cents. */
  buyRateCents: z.number().int().positive(),
  paidCents: cents,
  idChecked: z.boolean(),
  idRef: z.string().max(80),
  awaitingMelt: z.boolean(),
  meltedAt: isoDateTime.optional(),
});
export type OldGoldPurchase = z.infer<typeof OldGoldPurchaseSchema>;

export const LayawayPaymentSchema = z.object({ id: z.string(), date: isoDate, amountCents: cents });
export const LayawayPlanSchema = z.object({
  id: z.string(),
  customer: z.string(),
  pieceId: z.string().optional(),
  itemLabel: z.string(),
  /** Total including HST, what the customer will pay in all. */
  totalCents: cents,
  paidCents: cents,
  instalmentCents: cents,
  nextDue: z.string(),
  payments: z.array(LayawayPaymentSchema),
});
export type LayawayPlan = z.infer<typeof LayawayPlanSchema>;

export const LedgerSourceSchema = z.enum(["reservation", "counter", "bullion", "layaway", "job"]);
export type LedgerSource = z.infer<typeof LedgerSourceSchema>;
export const LedgerEntrySchema = z.object({
  id: z.string(),
  date: isoDate,
  ref: z.string(),
  source: LedgerSourceSchema,
  customer: z.string(),
  netCents: cents,
  hstCents: cents,
  /** Metal that left the shop with this sale, for the metal ledger. */
  metal: z.array(z.object({ karat: KaratSchema, gramsMilli: z.number().int().min(0) })).optional(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const EXPENSE_CATEGORIES = ["Gold purchase", "Diamonds and stones", "Rent", "Insurance", "Packaging", "Advertising", "Other"] as const;
export const ExpenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export const ExpenseSchema = z.object({
  id: z.string(),
  date: isoDate,
  vendor: z.string(),
  category: ExpenseCategorySchema,
  netCents: cents,
  hstCents: cents,
  invoiceUrl: z.string().optional(),
  metalKarat: KaratSchema.optional(),
  metalGramsMilli: z.number().int().min(0).optional(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const ExportFormatSchema = z.enum(["standard", "quickbooks", "xero", "pdf"]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export const AccountantSettingsSchema = z.object({
  name: z.string().max(80),
  email: z.string().max(120),
  format: ExportFormatSchema,
  autoSend: z.boolean(),
  includeReceipts: z.boolean(),
});
export type AccountantSettings = z.infer<typeof AccountantSettingsSchema>;

export const SendLogSchema = z.object({
  id: z.string(),
  period: z.string(),
  periodLabel: z.string(),
  format: ExportFormatSchema,
  to: z.string(),
  sentAt: isoDateTime,
  status: z.enum(["sent", "failed"]),
});
export type SendLog = z.infer<typeof SendLogSchema>;

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAYS)[number];
const HoursSchema = z.object({ open: z.number().int().min(0).max(1440), close: z.number().int().min(0).max(1440) }).nullable();
export const SettingsSchema = z.object({
  acceptOrders: z.boolean(),
  holdHours: z.number().int().min(1).max(336),
  lockRate: z.boolean(),
  sameDay: z.boolean(),
  hours: z.object({ sun: HoursSchema, mon: HoursSchema, tue: HoursSchema, wed: HoursSchema, thu: HoursSchema, fri: HoursSchema, sat: HoursSchema }),
  readyText: z.string().max(300),
  expiryText: z.string().max(300),
  buyRatePct: z.number().min(50).max(100),
  barPremiumPct: z.number().min(0).max(20),
  defaultMakingBps: z.object({ Earrings: z.number().int(), Chains: z.number().int(), Bridal: z.number().int(), Diamonds: z.number().int(), Bars: z.number().int() }),
  morningSuggestion: z.boolean(),
  showUpdatedAt: z.boolean(),
  showRateOnSite: z.boolean(),
  textOnNew: z.boolean(),
  slotCapacity: z.number().int().min(1).max(20),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const VisitRequestSchema = z.object({
  id: z.string(),
  createdAt: isoDateTime,
  type: z.string(),
  preferredDate: isoDate,
  name: z.string(),
  phone: z.string(),
  status: z.enum(["new", "called", "done"]),
});
export type VisitRequest = z.infer<typeof VisitRequestSchema>;

export const ValuationRequestSchema = z.object({
  id: z.string(),
  createdAt: isoDateTime,
  karat: KaratSchema,
  gramsMilli: z.number().int().positive(),
  estimateCents: cents,
  name: z.string(),
  phone: z.string(),
  preferredDate: isoDate,
  status: z.enum(["new", "called", "done"]),
});
export type ValuationRequest = z.infer<typeof ValuationRequestSchema>;

export const AuditEntrySchema = z.object({ id: z.string(), at: isoDateTime, actor: z.string(), action: z.string(), target: z.string(), meta: z.string().optional() });
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const SentMessageSchema = z.object({
  id: z.string(),
  at: isoDateTime,
  channel: z.enum(["sms", "email"]),
  to: z.string(),
  subject: z.string().optional(),
  body: z.string(),
  kind: z.string(),
});
export type SentMessage = z.infer<typeof SentMessageSchema>;

export const RoleSchema = z.enum(["owner", "staff"]);
export type Role = z.infer<typeof RoleSchema>;
export const SessionSchema = z.object({ role: RoleSchema, email: z.string() });
export type Session = z.infer<typeof SessionSchema>;

export const STORE_VERSION = 1 as const;
export const StoreDocSchema = z.object({
  version: z.literal(STORE_VERSION),
  createdAt: isoDateTime,
  rates: z.array(RateSchema),
  pieces: z.array(PieceSchema),
  reservations: z.array(ReservationSchema),
  jobs: z.array(JobSchema),
  oldGold: z.array(OldGoldPurchaseSchema),
  layaway: z.array(LayawayPlanSchema),
  ledger: z.array(LedgerEntrySchema),
  expenses: z.array(ExpenseSchema),
  accountant: AccountantSettingsSchema,
  sendLog: z.array(SendLogSchema),
  settings: SettingsSchema,
  visits: z.array(VisitRequestSchema),
  valuations: z.array(ValuationRequestSchema),
  audit: z.array(AuditEntrySchema),
  sent: z.array(SentMessageSchema),
  counters: z.object({ piece: z.number(), job: z.number(), reservation: z.number(), invoice: z.number(), layaway: z.number(), seq: z.number() }),
});
export type StoreDoc = z.infer<typeof StoreDocSchema>;

/* Input schemas for writes. Strict: unknown fields are rejected. */

export const PhoneInput = z.string().min(10).max(20);

export const ReserveInputSchema = z
  .object({
    lines: z.array(z.object({ pieceId: z.string(), option: z.string().max(30), qty: z.number().int().min(1).max(20) }).strict()).min(1).max(20),
    name: z.string().trim().min(2).max(80),
    phone: PhoneInput,
    visitStartAt: isoDateTime,
    visitEndAt: isoDateTime,
    _hp: z.string().max(200).optional(),
    _t: z.number().optional(),
  })
  .strict();
export type ReserveInput = z.infer<typeof ReserveInputSchema>;

export const VisitInputSchema = z
  .object({
    type: z.string().trim().min(2).max(40),
    preferredDate: isoDate,
    name: z.string().trim().min(2).max(80),
    phone: PhoneInput,
    _hp: z.string().max(200).optional(),
    _t: z.number().optional(),
  })
  .strict();
export type VisitInput = z.infer<typeof VisitInputSchema>;

export const ValuationInputSchema = z
  .object({
    karat: KaratSchema,
    gramsMilli: z.number().int().positive().max(5_000_000),
    name: z.string().trim().min(2).max(80),
    phone: PhoneInput,
    preferredDate: isoDate,
    _hp: z.string().max(200).optional(),
    _t: z.number().optional(),
  })
  .strict();
export type ValuationInput = z.infer<typeof ValuationInputSchema>;

export const NewPieceInputSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    category: CategorySchema,
    karat: KaratSchema.nullable(),
    netGramsMilli: z.number().int().min(0).max(5_000_000),
    makingBps: z.number().int().min(0).max(10000),
    stoneCents: cents,
    fixedCents: cents.optional(),
    units: z.number().int().min(1).max(500),
    certificateRef: z.string().max(80).optional(),
    image: z.string().max(200),
    description: z.string().max(400).optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type NewPieceInput = z.infer<typeof NewPieceInputSchema>;

export const NewOldGoldInputSchema = z
  .object({
    customer: z.string().trim().max(80),
    karat: KaratSchema,
    gramsMilli: z.number().int().positive().max(5_000_000),
    idChecked: z.boolean(),
    idRef: z.string().trim().max(80),
  })
  .strict();
export type NewOldGoldInput = z.infer<typeof NewOldGoldInputSchema>;

export const NewExpenseInputSchema = z
  .object({
    vendor: z.string().trim().min(2).max(120),
    category: ExpenseCategorySchema,
    netCents: z.number().int().positive().max(100_000_000),
    hstCents: z.number().int().min(0).max(100_000_000).optional(),
    invoiceUrl: z.string().max(200).optional(),
    metalKarat: KaratSchema.optional(),
    metalGramsMilli: z.number().int().min(0).optional(),
    date: isoDate.optional(),
  })
  .strict();
export type NewExpenseInput = z.infer<typeof NewExpenseInputSchema>;

export const NewJobInputSchema = z
  .object({
    customer: z.string().trim().min(2).max(80),
    phone: z.string().max(20).optional(),
    type: JobTypeSchema,
    title: z.string().trim().min(2).max(120),
    quoteCents: cents,
    depositCents: cents,
    dueDate: isoDate,
  })
  .strict();
export type NewJobInput = z.infer<typeof NewJobInputSchema>;

export const NewLayawayInputSchema = z
  .object({
    customer: z.string().trim().min(2).max(80),
    itemLabel: z.string().trim().min(2).max(120),
    totalCents: z.number().int().positive(),
    depositCents: cents,
    instalmentCents: z.number().int().positive(),
    nextDue: isoDate,
  })
  .strict();
export type NewLayawayInput = z.infer<typeof NewLayawayInputSchema>;
