#!/usr/bin/env bash
# Loads db/migrations/*.sql into a throwaway local Postgres and runs db/tests/smoke.sql. Needs postgres, initdb and psql on PATH.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
port=54329
cleanup() { pg_ctl -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
initdb -D "$tmp/data" -U postgres -A trust >/dev/null
pg_ctl -D "$tmp/data" -o "-p $port -k $tmp -c listen_addresses=''" -l "$tmp/log" -w start >/dev/null
export PGHOST="$tmp" PGPORT="$port" PGUSER=postgres
createdb gm
for f in "$root"/db/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d gm -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -t -d gm -f "$root/db/tests/smoke.sql" | tail -3
