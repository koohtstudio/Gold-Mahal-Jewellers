import { describe, expect, it } from "vitest";
import { assertEnv, missingEnv } from "@/lib/env";

describe("startup environment check", () => {
  it("needs nothing in mock mode", () => {
    expect(missingEnv({})).toEqual([]);
    expect(missingEnv({ NEXT_PUBLIC_APP_MODE: "mock" })).toEqual([]);
  });
  it("demo mode needs the database url", () => {
    expect(missingEnv({ NEXT_PUBLIC_APP_MODE: "demo" })).toEqual(["DATABASE_URL"]);
    expect(missingEnv({ NEXT_PUBLIC_APP_MODE: "demo", DATABASE_URL: "postgres://x" })).toEqual([]);
  });
  it("live mode fails loudly and lists every missing key", () => {
    expect(() => assertEnv({ NEXT_PUBLIC_APP_MODE: "live", DATABASE_URL: "x" })).toThrow(/DATABASE_URL_UNPOOLED, NEON_AUTH_BASE_URL, RESEND_API_KEY, CRON_SECRET/);
  });
});
