import { DomainError } from "@/lib/domain/errors";
import type { Repo } from "../types";

/**
 * STUB. The live adapter for Neon Postgres. Every method throws NotImplemented and points at the SQL it will call.
 * The same contract suite (tests/contract) must pass against it before NEXT_PUBLIC_APP_MODE=live is allowed.
 * Order of work is in TODO-LIVE.md.
 */

const SQL_POINTERS: Record<string, string> = {
  rates: "db/migrations/0001_init.sql: table rates. Publish inserts a row and an audit_log row in one transaction.",
  pieces: "db/migrations/0001_init.sql: view v_shop_pieces (public reads, price computed in SQL), table pieces (staff writes).",
  reservations: "db/migrations/0001_init.sql: function create_reservation(...) locks the rate in the same transaction. Desk lookup is rate limited.",
  jobs: "db/migrations/0001_init.sql: table jobs.",
  oldGold: "db/migrations/0001_init.sql: table old_gold. idRef is owner only and every view writes audit_log.",
  layaway: "db/migrations/0001_init.sql: tables layaway, layaway_payments. A payment also inserts a ledger_entries row.",
  books: "db/migrations/0001_init.sql: tables ledger_entries, expenses. Period filters are plain date ranges.",
  settings: "db/migrations/0001_init.sql: table settings (single row).",
  visits: "db/migrations/0001_init.sql: tables visit_requests, valuation_requests.",
  audit: "db/migrations/0001_init.sql: table audit_log.",
  ports: "Auth: Neon Auth. Storage: Neon Object Storage (private bucket). Notify: SMS and email provider. Accountant: Resend zip plus cron. See TODO-LIVE.md.",
  mode: "",
  ready: "Connect through the pooled DATABASE_URL.",
  subscribe: "Neon Realtime live queries, or a 5 second poll.",
  reset: "Not available in live mode.",
};

function notImplemented(path: string): never {
  const area = path.split(".")[0] ?? "";
  throw new DomainError("not_implemented", `Neon adapter: ${path} is not built yet. TODO: ${SQL_POINTERS[area] ?? "see TODO-LIVE.md"}`);
}

function stub(path: string): unknown {
  return new Proxy(function () {}, {
    get: (_t, key) => (key === "then" ? undefined : stub(`${path}.${String(key)}`)),
    apply: () => notImplemented(path),
  });
}

export function createNeonRepo(): Repo {
  return new Proxy({} as Repo, {
    get: (_t, key) => (key === "mode" ? "live" : stub(String(key))),
  });
}
