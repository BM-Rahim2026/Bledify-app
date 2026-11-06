// Applies supabase/migrations/*.sql to the Supabase database, once each.
// Runs before `next build` on Vercel, using the connection string the
// Vercel ↔ Supabase integration provides. Skips quietly when none is set.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] no database URL set — skipping migrations");
  process.exit(0);
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

// Supabase's server certificate is signed by Supabase's own CA, which Node
// does not ship with; the connection is still encrypted.
const conn = new URL(url);
conn.searchParams.delete("sslmode");
conn.searchParams.delete("supa");
const client = new pg.Client({ connectionString: conn.toString(), ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(`create table if not exists public._bledify_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  await client.query("alter table public._bledify_migrations enable row level security");
  await client.query("select pg_advisory_lock(727001)");
  const done = new Set((await client.query("select name from public._bledify_migrations")).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    console.log(`[migrate] applying ${f}`);
    await client.query("begin");
    try {
      await client.query(readFileSync(join(dir, f), "utf8"));
      await client.query("insert into public._bledify_migrations (name) values ($1)", [f]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log("[migrate] database is up to date");
} catch (e) {
  console.error("[migrate] failed:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
