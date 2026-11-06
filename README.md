# Bledify

Boutique en ligne + gestion des commandes en paiement à la livraison pour les
vendeurs algériens (Facebook, Instagram). FR / AR.

**Stack:** Next.js on Vercel · Supabase (Postgres, Auth, Storage) · GitHub Actions CI.

## Features (V1)
- Seller sign-up / login (email + password, reset by email), FR/AR with RTL
- Shop with public link `/s/<slug>`, products with photos, prices in DA, home / stop-desk delivery fees
- Public COD order form (58 wilayas), duplicate block (10 min), rate limits, Algerian mobile validation
- Order desk: Nouvelle → Confirmée → Expédiée → Livrée, Annulée, Retournée; one-tap next step;
  "Changer le statut"; dated history; Appeler / WhatsApp with pre-filled message; call results with
  "Pas de réponse ×N"; carrier + tracking number on shipping; status tabs with counts; search
- "Client à risque" badge, stats (week/month in Algeria time, confirmation / delivery / return rates, revenue)
- Customer order tracking `/track` (order number + phone)
- Printable shipping labels (single or all confirmed)
- New-order email alerts (Resend, optional)
- Installable web app (manifest)

## Deploy (Vercel + Supabase)
1. Import this repo in Vercel.
2. In the Vercel project: **Storage → Connect Database → Supabase** (create or link a project).
   This sets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` and `POSTGRES_URL_NON_POOLING`.
3. Redeploy. The build applies `supabase/migrations` automatically.
4. In Supabase → Authentication → URL Configuration, set **Site URL** to your Vercel URL
   and add `https://<your-domain>/auth/callback` to the redirect URLs.
5. Optional: `NEXT_PUBLIC_SITE_URL` (your domain), `RESEND_API_KEY` + `MAIL_FROM` for email alerts.

## Local development
```bash
cp .env.example .env.local   # fill in Supabase values
npm install
npm run migrate
npm run dev
```

## Tests
```bash
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/scratch npm run test:db
```
Runs the order rules (status history, call results, duplicate block, rate limit, risk,
owner isolation, tracking, Algeria-time stats) against a plain Postgres with a Supabase stub.
