-- Demo mode only. One row per shared demo room. Holds the whole sample data document as JSON.
-- This is NOT the live schema. The live relational schema is db/migrations/0001_init.sql (written, not applied).
-- Applied to the gold-mahal-demo Neon project. The API route also creates it if missing.
CREATE TABLE IF NOT EXISTS demo_rooms (
  room       text PRIMARY KEY CHECK (room ~ '^[a-z0-9-]{1,40}$'),
  version    integer NOT NULL CHECK (version >= 1),
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
