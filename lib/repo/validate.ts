import { StoreDocSchema, type StoreDoc } from "@/lib/domain/schemas";

export { StoreDocSchema };

/** Full validation. Loaded on the first write, not at page start, so Zod stays off the critical path. */
export function parseDoc(raw: string | null): StoreDoc | null {
  if (!raw) return null;
  try {
    const r = StoreDocSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
