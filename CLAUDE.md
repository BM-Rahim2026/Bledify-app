# Bledify

Mobile-first selling tool for Algerian sellers on Facebook / Instagram: a shop
link, cash-on-delivery (COD) orders, and an order desk to confirm, ship and
track. French and Arabic (RTL). Full product brief:
https://claude.ai/artifact/27UBTGXDXnza87jbCa87r8

@AGENTS.md

## Stack
- Next.js 16 (App Router) on Vercel. Seller app is client-rendered (`src/app/seller`),
  public shop `/s/[slug]` is server-rendered for Facebook link previews.
- Supabase: Postgres + Auth (email/password) + Storage (`product-images` bucket).
- All business rules live in SQL: `supabase/migrations/*.sql`. Migrations run
  automatically before `next build` (`scripts/migrate.mjs`), once each.

## Rules to keep
- Statuses: new, confirmed, shipped, delivered, cancelled, returned (legacy
  pending/ready display only). Change status only via `set_order_status` /
  `record_call`; the `orders_before_write` trigger appends `{status, at}` to
  `history` and blocks direct edits to history / no_answer_count.
- Call result only on `new` orders (error P0409). Duplicate public order
  (same shop + phone + items) blocked 10 min (P0409). Rate limits → P0429.
- Risk = phone has 2+ returned/cancelled orders at the same shop (`orders_view.risk`).
- Stats in Africa/Algiers time, weeks start Monday (`seller_stats`).
- Every seller query is scoped by RLS `owner_id = auth.uid()`. Public writes
  only through `/api/orders` → `place_order` (service role); prices come from the DB.
- All UI text through `useI18n().t` / `src/lib/i18n/dict.ts` (fr + ar, same keys).
  Use logical CSS (`ms-`, `ps-`, `text-start`) so Arabic flips. Money via `formatDZD`.

## Commands
- `npm run dev` — local dev (needs `.env.local`, see `.env.example`)
- `npm run lint`, `npm run typecheck`
- `TEST_DATABASE_URL=postgres://… npm run test:db` — SQL rules against a scratch Postgres
- New schema change → add `supabase/migrations/000N_name.sql` (never edit an applied one)
