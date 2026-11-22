import { neon } from "@neondatabase/serverless";
import { MAX_ROOMS, type DocStore, type PutResult, type RoomRow } from "./server";

/** The demo room store on Neon Postgres. One row per room, optimistic concurrency by version. */
export function createNeonDocStore(url: string): DocStore {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  const ensure = () =>
    (ready ??= sql.query(`CREATE TABLE IF NOT EXISTS demo_rooms (
      room text PRIMARY KEY CHECK (room ~ '^[a-z0-9-]{1,40}$'),
      version integer NOT NULL CHECK (version >= 1),
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now())`));

  const read = async (room: string): Promise<RoomRow | null> => {
    const rows = (await sql.query("SELECT version, data FROM demo_rooms WHERE room = $1", [room])) as Array<{ version: number; data: unknown }>;
    const r = rows[0];
    return r ? { version: r.version, data: r.data } : null;
  };

  return {
    async get(room) {
      await ensure();
      return read(room);
    },
    async put(room, expectedVersion, data): Promise<PutResult> {
      await ensure();
      const json = JSON.stringify(data);
      if (expectedVersion === 0) {
        const rows = (await sql.query(
          `INSERT INTO demo_rooms (room, version, data)
           SELECT $1, 1, $2::jsonb WHERE (SELECT count(*) FROM demo_rooms) < ${MAX_ROOMS}
           ON CONFLICT (room) DO NOTHING RETURNING version`,
          [room, json],
        )) as Array<{ version: number }>;
        if (rows[0]) return { ok: true, version: rows[0].version };
        const cur = await read(room);
        return cur ? { ok: false, reason: "conflict", current: cur } : { ok: false, reason: "full" };
      }
      const rows = (await sql.query("UPDATE demo_rooms SET version = version + 1, data = $2::jsonb, updated_at = now() WHERE room = $1 AND version = $3 RETURNING version", [room, json, expectedVersion])) as Array<{ version: number }>;
      if (rows[0]) return { ok: true, version: rows[0].version };
      return { ok: false, reason: "conflict", current: await read(room) };
    },
  };
}
