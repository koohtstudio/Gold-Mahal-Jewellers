import { StoreDocSchema } from "@/lib/domain/schemas";
import { RateLimiter } from "@/lib/guards";
import { z } from "zod";

/**
 * Server side of demo mode: one JSON document per room, shared by every device.
 * Writes use optimistic concurrency (a version number), so two devices never overwrite each other silently.
 * This is a sample data sandbox. It has no sign in and must never hold real customer or business data.
 */

export const MAX_BODY_BYTES = 1_500_000;
export const MAX_ROOMS = 500;
export const ROOM_RE = /^[a-z0-9-]{1,40}$/;

export interface RoomRow {
  version: number;
  data: unknown;
}

export type PutResult = { ok: true; version: number } | { ok: false; reason: "conflict"; current: RoomRow | null } | { ok: false; reason: "full" };

export interface DocStore {
  get(room: string): Promise<RoomRow | null>;
  /** expectedVersion 0 means "create". Otherwise the row must still be at that version. */
  put(room: string, expectedVersion: number, data: unknown): Promise<PutResult>;
}

export class MemoryDocStore implements DocStore {
  private rooms = new Map<string, RoomRow>();
  async get(room: string) {
    const r = this.rooms.get(room);
    return r ? { version: r.version, data: structuredClone(r.data) } : null;
  }
  async put(room: string, expectedVersion: number, data: unknown): Promise<PutResult> {
    const cur = this.rooms.get(room);
    if (expectedVersion === 0) {
      if (cur) return { ok: false, reason: "conflict", current: { version: cur.version, data: structuredClone(cur.data) } };
      if (this.rooms.size >= MAX_ROOMS) return { ok: false, reason: "full" };
      this.rooms.set(room, { version: 1, data: structuredClone(data) });
      return { ok: true, version: 1 };
    }
    if (!cur || cur.version !== expectedVersion) return { ok: false, reason: "conflict", current: cur ? { version: cur.version, data: structuredClone(cur.data) } : null };
    this.rooms.set(room, { version: cur.version + 1, data: structuredClone(data) });
    return { ok: true, version: cur.version + 1 };
  }
}

export interface Reply {
  status: number;
  body: unknown;
}

const PostSchema = z.object({ expectedVersion: z.number().int().min(0), data: StoreDocSchema }).strict();

const reads = new RateLimiter(600, 60_000);
const writes = new RateLimiter(120, 60_000);

export async function handleGet(store: DocStore, room: string | null, since: number, client = "anon"): Promise<Reply> {
  if (!room || !ROOM_RE.test(room)) return { status: 400, body: { error: "That room name is not allowed." } };
  if (!reads.take(client)) return { status: 429, body: { error: "Too many requests. Please slow down." } };
  const row = await store.get(room);
  const version = row?.version ?? 0;
  if (version === since) return { status: 200, body: { changed: false, version } };
  return { status: 200, body: { changed: true, version, data: row?.data ?? null } };
}

export async function handlePost(store: DocStore, room: string | null, rawBody: string, client = "anon"): Promise<Reply> {
  if (!room || !ROOM_RE.test(room)) return { status: 400, body: { error: "That room name is not allowed." } };
  if (!writes.take(client)) return { status: 429, body: { error: "Too many changes too quickly. Please wait a moment." } };
  if (rawBody.length > MAX_BODY_BYTES) return { status: 413, body: { error: "That is too much data for the demo." } };
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "That was not valid JSON." } };
  }
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) return { status: 422, body: { error: "That data does not match the shop's format." } };
  const res = await store.put(room, parsed.data.expectedVersion, parsed.data.data);
  if (res.ok) return { status: 200, body: { version: res.version } };
  if (res.reason === "full") return { status: 507, body: { error: "The demo has too many rooms. Use the shared room." } };
  return { status: 409, body: { version: res.current?.version ?? 0, data: res.current?.data ?? null } };
}
