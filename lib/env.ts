/** Startup checks. In live mode a missing key must stop the app at boot, not fail later in front of a customer. */

export interface EnvLike {
  [key: string]: string | undefined;
}

const LIVE_KEYS = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "NEON_AUTH_BASE_URL", "RESEND_API_KEY", "CRON_SECRET"] as const;
const DEMO_KEYS = ["DATABASE_URL"] as const;

export function missingEnv(env: EnvLike): string[] {
  const mode = env.NEXT_PUBLIC_APP_MODE;
  const need = mode === "live" ? LIVE_KEYS : mode === "demo" ? DEMO_KEYS : [];
  return need.filter((k) => !env[k] || env[k]?.trim() === "");
}

export function assertEnv(env: EnvLike = process.env): void {
  const missing = missingEnv(env);
  if (missing.length > 0) {
    throw new Error(`NEXT_PUBLIC_APP_MODE=${env.NEXT_PUBLIC_APP_MODE} needs these environment variables: ${missing.join(", ")}. See .env.example and TODO-LIVE.md.`);
  }
  if (env.NEXT_PUBLIC_APP_MODE === "live") {
    console.warn("Live mode is on. The Neon adapter in lib/repo/neon is still a stub, see TODO-LIVE.md.");
  }
}
