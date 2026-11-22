import { NextResponse, type NextRequest } from "next/server";
import { createNeonDocStore } from "@/lib/demo/neon";
import { handleGet, handlePost, type DocStore } from "@/lib/demo/server";

export const dynamic = "force-dynamic";

let store: DocStore | null = null;
function getStore(): DocStore | null {
  if (store) return store;
  const mode = process.env.NEXT_PUBLIC_APP_MODE;
  if (mode !== "demo") return null;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_MODE=demo needs DATABASE_URL (a Neon connection string).");
  store = createNeonDocStore(url);
  return store;
}

const client = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
const off = () => NextResponse.json({ error: "Demo mode is not switched on for this site." }, { status: 404 });
const json = (r: { status: number; body: unknown }) => NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const s = getStore();
  if (!s) return off();
  const since = Number(req.nextUrl.searchParams.get("since") ?? "0");
  return json(await handleGet(s, req.nextUrl.searchParams.get("room"), Number.isInteger(since) ? since : 0, client(req)));
}

export async function POST(req: NextRequest) {
  const s = getStore();
  if (!s) return off();
  return json(await handlePost(s, req.nextUrl.searchParams.get("room"), await req.text(), client(req)));
}

