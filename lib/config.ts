export type AppMode = "mock" | "demo" | "live";

function parseMode(v: string | undefined): AppMode {
  return v === "demo" || v === "live" ? v : "mock";
}

function parseLatency(v: string | undefined): [number, number] | null {
  if (v === undefined || v === "") return [150, 400];
  if (v === "off" || v === "0") return null;
  const m = /^(\d+)-(\d+)$/.exec(v);
  if (!m) return [150, 400];
  return [Number(m[1]), Number(m[2])];
}

/** NEXT_PUBLIC_ values are inlined at build time, so each one is read by its full name. */
export const config = {
  mode: parseMode(process.env.NEXT_PUBLIC_APP_MODE),
  allowIndexing: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  latency: parseLatency(process.env.NEXT_PUBLIC_MOCK_LATENCY),
  demoRoom: process.env.NEXT_PUBLIC_DEMO_ROOM || "pitch",
} as const;

export const STORE_KEY = "gm-mock-v1";
export const SESSION_COOKIE = "gm_session";
export const BAG_KEY = "gm-bag";
