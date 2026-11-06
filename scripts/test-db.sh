#!/usr/bin/env bash
# Rebuilds a throwaway test database and runs the database tests.
# Usage: TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
set -euo pipefail
: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to an empty test database}"
PGOPTIONS="-c client_min_messages=warning" psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; create schema public;"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  PGOPTIONS="-c client_min_messages=warning" psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
node --test tests/*.test.mjs
