-- Admin v2: action log, internal notes, blocked buyer accounts, user reports & order disputes,
-- listing review queue, analytics and global search.

-- Every admin function calls require_admin(); it now also marks the request as an admin action,
-- so the log below only records changes made through the admin console.
create or replace function public.require_admin()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
  perform set_config('bledify.admin_action', 'on', true);
end $$;
revoke all on function public.require_admin() from public, anon;

-- ---------------------------------------------------------------- action log (automatic)
create table if not exists public.admin_audit (
  id bigserial primary key,
  admin_id uuid,
  admin_email text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null default '',
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit (target_type, target_id);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- Records the changed columns (listed in the trigger arguments) when an admin makes the change.
create or replace function public.audit_admin_change()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  diff jsonb := '{}'::jsonb;
  k text;
begin
  if current_setting('bledify.admin_action', true) is distinct from 'on' then return null; end if;
  foreach k in array tg_argv loop
    if (o->k) is distinct from (n->k) then
      diff := diff || jsonb_build_object(k, jsonb_build_object('from', o->k, 'to', n->k));
    end if;
  end loop;
  if diff = '{}'::jsonb and tg_op = 'UPDATE' then return null; end if;
  insert into public.admin_audit (admin_id, admin_email, action, target_type, target_id, details)
  values (auth.uid(), coalesce((select email from auth.users where id = auth.uid()), ''),
          lower(tg_op), tg_table_name, coalesce(n->>'id', o->>'id', n->>'slug', o->>'slug', n->>'email', o->>'email', ''), diff);
  return null;
end $$;

drop trigger if exists audit_shops on public.shops;
create trigger audit_shops after update on public.shops for each row
  execute function public.audit_admin_change('status', 'verified', 'suspended', 'suspended_reason', 'commission_pct', 'review_note');
drop trigger if exists audit_products on public.products;
create trigger audit_products after update on public.products for each row
  execute function public.audit_admin_change('blocked', 'block_reason', 'reviewed_at');
drop trigger if exists audit_offer_entries on public.offer_entries;
create trigger audit_offer_entries after update on public.offer_entries for each row
  execute function public.audit_admin_change('status', 'note');
drop trigger if exists audit_offers on public.offers;
create trigger audit_offers after insert or update on public.offers for each row
  execute function public.audit_admin_change('title_fr', 'title_ar', 'kind', 'active', 'image', 'position');
drop trigger if exists audit_orders on public.orders;
create trigger audit_orders after update on public.orders for each row
  execute function public.audit_admin_change('payment_status');
drop trigger if exists audit_ledger on public.seller_ledger;
create trigger audit_ledger after insert on public.seller_ledger for each row
  execute function public.audit_admin_change('kind', 'amount_dzd', 'shop_id', 'note');
drop trigger if exists audit_reviews on public.reviews;
create trigger audit_reviews after update on public.reviews for each row
  execute function public.audit_admin_change('hidden');
drop trigger if exists audit_settings on public.platform_settings;
create trigger audit_settings after update on public.platform_settings for each row
  execute function public.audit_admin_change('commission_pct', 'payout_delay_days', 'unpaid_expiry_minutes');
drop trigger if exists audit_admin_emails on public.admin_emails;
create trigger audit_admin_emails after insert or delete on public.admin_emails for each row
  execute function public.audit_admin_change('email');

-- ---------------------------------------------------------------- internal notes
create table if not exists public.admin_notes (
  id bigserial primary key,
  target_type text not null check (target_type in ('shop', 'customer', 'order')),
  target_id text not null,
  admin_email text not null default '',
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists admin_notes_target_idx on public.admin_notes (target_type, target_id, created_at desc);
alter table public.admin_notes enable row level security;
revoke all on public.admin_notes from anon, authenticated;

-- ---------------------------------------------------------------- blocked buyer accounts
create table if not exists public.blocked_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default '',
  blocked_by text not null default '',
  created_at timestamptz not null default now()
);
alter table public.blocked_users enable row level security;
revoke all on public.blocked_users from anon, authenticated;

-- the signed-in user's block (for /api/orders and the account page)
create or replace function public.my_block()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('reason', reason) from public.blocked_users where user_id = auth.uid()
$$;
grant execute on function public.my_block() to authenticated;

-- ---------------------------------------------------------------- reports and disputes
create table if not exists public.reports (
  id bigserial primary key,
  kind text not null check (kind in ('product', 'shop', 'order')),
  target_id uuid not null,
  shop_id uuid references public.shops (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('imported', 'counterfeit', 'prohibited', 'inappropriate', 'wrong_info', 'scam',
                                          'not_received', 'damaged', 'not_as_described', 'wrong_item', 'other')),
  details text not null default '' check (length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text not null default '',
  resolved_by text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

-- A signed-in user reports a product, a shop, or a problem with one of their orders.
create or replace function public.submit_report(p_kind text, p_target uuid, p_reason text, p_details text default '')
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare
  sid uuid; o public.orders; delivered_at timestamptz; rid bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if (select count(*) from public.reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;
  if p_kind = 'product' then
    select shop_id into sid from public.products where id = p_target;
  elsif p_kind = 'shop' then
    select id into sid from public.shops where id = p_target;
  elsif p_kind = 'order' then
    select * into o from public.orders where id = p_target and customer_id = auth.uid();
    if o.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if o.status not in ('shipped', 'delivered') then raise exception 'NOT_ALLOWED' using errcode = 'P0409'; end if;
    select max((h->>'at')::timestamptz) into delivered_at from jsonb_array_elements(o.history) h where h->>'status' = 'delivered';
    -- policy: problems are reported within 4 working days of delivery (7 calendar days here)
    if o.status = 'delivered' and delivered_at < now() - interval '7 days' then raise exception 'TOO_LATE' using errcode = 'P0409'; end if;
    if exists (select 1 from public.reports where kind = 'order' and target_id = o.id and status = 'open') then
      raise exception 'ALREADY_REPORTED' using errcode = 'P0409';
    end if;
    sid := o.shop_id;
  else
    raise exception 'INVALID' using errcode = '22023';
  end if;
  if sid is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if (p_kind = 'order') <> (p_reason in ('not_received', 'damaged', 'not_as_described', 'wrong_item', 'other')) and p_reason <> 'other' then
    raise exception 'INVALID' using errcode = '22023';
  end if;
  insert into public.reports (kind, target_id, shop_id, reporter_id, reason, details)
  values (p_kind, p_target, sid, auth.uid(), p_reason, left(trim(coalesce(p_details, '')), 1000))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.submit_report(text, uuid, text, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

create or replace function public.my_reports()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'target_id', target_id, 'reason', reason,
    'status', status, 'resolution', resolution, 'created_at', created_at) order by created_at desc), '[]'::jsonb)
  from public.reports where reporter_id = auth.uid()
$$;
grant execute on function public.my_reports() to authenticated;

-- ---------------------------------------------------------------- listing review queue
alter table public.products add column if not exists reviewed_at timestamptz;
update public.products set reviewed_at = now() where reviewed_at is null;

-- a shop's new or edited listing needs a new check (the team's own changes never reset it)
create or replace function public.products_review_reset()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.reviewed_at := null;
    elsif (new.name, new.description, new.story, new.images, new.category) is distinct from
          (old.name, old.description, old.story, old.images, old.category) then new.reviewed_at := null;
    else new.reviewed_at := old.reviewed_at; end if;
  end if;
  return new;
end $$;
drop trigger if exists products_review_reset on public.products;
create trigger products_review_reset before insert or update on public.products
  for each row execute function public.products_review_reset();

-- ---------------------------------------------------------------- admin functions
create or replace function public.admin_me()
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce((select email from auth.users where id = auth.uid()), '')
$$;

-- badge counts for the menu
create or replace function public.admin_counts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'applications', (select count(*) from public.shops where status = 'pending'),
    'review_queue', (select count(*) from public.products p join public.shops s on s.id = p.shop_id
                     where p.reviewed_at is null and not p.blocked and s.status = 'approved' and not s.verified),
    'reports', (select count(*) from public.reports where status = 'open'),
    'refunds', (select count(*) from public.orders where payment_status = 'refund_due'),
    'offers', (select count(*) from public.offer_entries where status = 'pending'));
end $$;

-- Period analytics (Algeria days) with the previous period for comparison.
create or replace function public.admin_analytics(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 1), 365);
  t1 timestamptz := now(); t0 timestamptz := now() - make_interval(days => d); tp timestamptz := now() - make_interval(days => 2 * d);
begin
  perform public.require_admin();
  return jsonb_build_object(
    'days', d,
    'current', public.admin_period_kpis(t0, t1),
    'previous', public.admin_period_kpis(tp, t0),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', g.day, 'orders', coalesce(x.orders, 0), 'gmv', coalesce(x.gmv, 0)) order by g.day)
      from generate_series(((t0 at time zone 'Africa/Algiers')::date + 1), (t1 at time zone 'Africa/Algiers')::date, interval '1 day') g(day)
      left join (select (created_at at time zone 'Africa/Algiers')::date dd, count(*) orders,
                        sum(total_dzd) filter (where status not in ('cancelled', 'returned')) gmv
                 from public.orders where source = 'shop' and payment_status not in ('pending', 'failed') and created_at >= t0
                 group by 1) x on x.dd = g.day::date), '[]'::jsonb),
    'top_shops', coalesce((select jsonb_agg(x order by x.gmv desc) from (
      select s.id, s.name, s.slug, count(o.id) orders, sum(o.total_dzd) gmv from public.orders o join public.shops s on s.id = o.shop_id
      where o.source = 'shop' and o.created_at >= t0 and o.payment_status not in ('pending', 'failed') and o.status not in ('cancelled', 'returned')
      group by s.id order by gmv desc limit 8) x), '[]'::jsonb),
    'top_categories', coalesce((select jsonb_agg(x order by x.gmv desc) from (
      select p.category, sum((i->>'unit_price_dzd')::int * (i->>'quantity')::int) gmv, sum((i->>'quantity')::int) units
      from public.orders o cross join jsonb_array_elements(o.items) i join public.products p on p.id = (i->>'product_id')::uuid
      where o.source = 'shop' and o.created_at >= t0 and o.payment_status not in ('pending', 'failed') and o.status not in ('cancelled', 'returned')
      group by p.category) x), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(x order by x.units desc) from (
      select p.id, p.name, s.name shop, sum((i->>'quantity')::int) units, sum((i->>'unit_price_dzd')::int * (i->>'quantity')::int) gmv
      from public.orders o cross join jsonb_array_elements(o.items) i join public.products p on p.id = (i->>'product_id')::uuid
      join public.shops s on s.id = p.shop_id
      where o.source = 'shop' and o.created_at >= t0 and o.payment_status not in ('pending', 'failed') and o.status not in ('cancelled', 'returned')
      group by p.id, s.name order by units desc limit 8) x), '[]'::jsonb),
    'catalog', jsonb_build_object(
      'no_photo', (select count(*) from public.products where active and coalesce(array_length(images, 1), 0) = 0),
      'no_subcategory', (select count(*) from public.products where active and subcategory is null),
      'no_story', (select count(*) from public.products where active and coalesce(story, '') = ''),
      'empty_shops', (select count(*) from public.shops s where s.status = 'approved' and not s.suspended
                      and not exists (select 1 from public.products p where p.shop_id = s.id and p.active)),
      'old_applications', (select count(*) from public.shops where status = 'pending' and created_at < now() - interval '3 days')));
end $$;

create or replace function public.admin_period_kpis(t0 timestamptz, t1 timestamptz)
returns jsonb language sql stable security definer set search_path = public, auth as $$
  with o as (select * from public.orders where source = 'shop' and payment_status not in ('pending', 'failed')
             and created_at >= t0 and created_at < t1)
  select jsonb_build_object(
    'orders', (select count(*) from o),
    'gmv', (select coalesce(sum(total_dzd), 0) from o where status not in ('cancelled', 'returned')),
    'aov', (select coalesce(round(avg(total_dzd)), 0) from o where status not in ('cancelled', 'returned')),
    'commission', (select coalesce(sum(commission_dzd), 0) from o where status = 'delivered'),
    'delivered', (select count(*) from o where status = 'delivered'),
    'returned', (select count(*) from o where status = 'returned'),
    'cancelled', (select count(*) from o where status = 'cancelled'),
    'card_share', (select coalesce(round(100.0 * count(*) filter (where amount_online_dzd > 0) / nullif(count(*), 0)), 0) from o),
    'new_buyers', (select count(*) from (select customer_id, min(created_at) f from public.orders where customer_id is not null group by 1) b where b.f >= t0 and b.f < t1),
    'new_users', (select count(*) from auth.users where created_at >= t0 and created_at < t1),
    'new_shops', (select count(*) from public.shops where created_at >= t0 and created_at < t1),
    'new_products', (select count(*) from public.products where created_at >= t0 and created_at < t1))
$$;
revoke all on function public.admin_period_kpis(timestamptz, timestamptz) from public, anon, authenticated;

-- Search across orders, shops, customers and products.
create or replace function public.admin_search(p_q text)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare q text := trim(coalesce(p_q, '')); digits text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  perform public.require_admin();
  if length(q) < 2 then return jsonb_build_object('orders', '[]'::jsonb, 'shops', '[]'::jsonb, 'customers', '[]'::jsonb, 'products', '[]'::jsonb); end if;
  return jsonb_build_object(
    'orders', coalesce((select jsonb_agg(x) from (select o.id, o.number, o.customer_name, o.total_dzd, o.status from public.orders o
       where o.number ilike '%' || q || '%' or o.customer_name ilike '%' || q || '%' or (length(digits) >= 4 and o.phone like '%' || digits || '%')
       order by o.created_at desc limit 6) x), '[]'::jsonb),
    'shops', coalesce((select jsonb_agg(x) from (select s.id, s.name, s.slug, s.status from public.shops s join auth.users u on u.id = s.owner_id
       where s.name ilike '%' || q || '%' or s.slug ilike '%' || q || '%' or u.email ilike '%' || q || '%' or (length(digits) >= 4 and s.phone like '%' || digits || '%')
       order by s.created_at desc limit 6) x), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(x) from (select u.id, u.email, u.raw_user_meta_data->>'full_name' name from auth.users u
       where u.email ilike '%' || q || '%' or u.raw_user_meta_data->>'full_name' ilike '%' || q || '%'
          or (length(digits) >= 4 and u.raw_user_meta_data->>'phone' like '%' || digits || '%')
       order by u.created_at desc limit 6) x), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(x) from (select p.id, p.name, s.name shop from public.products p join public.shops s on s.id = p.shop_id
       where p.name ilike '%' || q || '%' order by p.created_at desc limit 6) x), '[]'::jsonb));
end $$;

-- Accounts (buyers and sellers) with their activity.
create or replace function public.admin_customers(p_q text default '', p_filter text default '')
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
    select u.created_at, jsonb_build_object('id', u.id, 'email', u.email, 'name', u.raw_user_meta_data->>'full_name',
      'phone', u.raw_user_meta_data->>'phone', 'created_at', u.created_at, 'confirmed', u.email_confirmed_at is not null,
      'orders', coalesce(st.orders, 0), 'delivered', coalesce(st.delivered, 0), 'refused', coalesce(st.refused, 0),
      'spent', coalesce(st.spent, 0), 'last_order', st.last_order,
      'shop', (select jsonb_build_object('id', s.id, 'name', s.name) from public.shops s where s.owner_id = u.id),
      'blocked', b.user_id is not null) j
    from auth.users u
    left join (select customer_id, count(*) orders, count(*) filter (where status = 'delivered') delivered,
                 count(*) filter (where status in ('returned', 'cancelled')) refused,
                 sum(total_dzd) filter (where status = 'delivered') spent, max(created_at) last_order
               from public.orders where customer_id is not null and payment_status not in ('pending', 'failed') group by customer_id) st on st.customer_id = u.id
    left join public.blocked_users b on b.user_id = u.id
    where (coalesce(p_q, '') = '' or u.email ilike '%' || p_q || '%' or u.raw_user_meta_data->>'full_name' ilike '%' || p_q || '%'
           or u.raw_user_meta_data->>'phone' like '%' || p_q || '%')
      and (coalesce(p_filter, '') = ''
           or (p_filter = 'buyers' and st.orders > 0)
           or (p_filter = 'sellers' and exists (select 1 from public.shops s where s.owner_id = u.id))
           or (p_filter = 'risky' and coalesce(st.refused, 0) >= 2)
           or (p_filter = 'blocked' and b.user_id is not null))
    order by u.created_at desc limit 500) x), '[]'::jsonb);
end $$;

create or replace function public.admin_customer(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return (select jsonb_build_object('id', u.id, 'email', u.email, 'name', u.raw_user_meta_data->>'full_name',
      'phone', u.raw_user_meta_data->>'phone', 'wilaya', u.raw_user_meta_data->>'wilaya', 'created_at', u.created_at,
      'confirmed', u.email_confirmed_at is not null,
      'blocked', (select jsonb_build_object('reason', b.reason, 'by', b.blocked_by, 'at', b.created_at) from public.blocked_users b where b.user_id = u.id),
      'shop', (select jsonb_build_object('id', s.id, 'name', s.name, 'status', s.status) from public.shops s where s.owner_id = u.id),
      'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'status', o.status, 'payment_status', o.payment_status,
          'total_dzd', o.total_dzd, 'created_at', o.created_at, 'shop', s.name) order by o.created_at desc)
        from public.orders o join public.shops s on s.id = o.shop_id where o.customer_id = u.id), '[]'::jsonb),
      'reports', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'reason', r.reason, 'status', r.status,
          'created_at', r.created_at) order by r.created_at desc) from public.reports r where r.reporter_id = u.id), '[]'::jsonb),
      'reviews', (select count(*) from public.reviews r where r.customer_id = u.id))
    from auth.users u where u.id = p_user);
end $$;

create or replace function public.admin_set_user_blocked(p_user uuid, p_blocked boolean, p_reason text default '')
returns void language plpgsql volatile security definer set search_path = public, auth as $$
declare me text := public.admin_me();
begin
  perform public.require_admin();
  if p_user = auth.uid() then raise exception 'CANNOT_BLOCK_SELF' using errcode = '22023'; end if;
  if p_blocked then
    insert into public.blocked_users (user_id, reason, blocked_by) values (p_user, left(coalesce(p_reason, ''), 300), me)
    on conflict (user_id) do update set reason = excluded.reason, blocked_by = excluded.blocked_by, created_at = now();
  else
    delete from public.blocked_users where user_id = p_user;
  end if;
  insert into public.admin_audit (admin_id, admin_email, action, target_type, target_id, details)
  values (auth.uid(), me, case when p_blocked then 'block' else 'unblock' end, 'users', p_user::text, jsonb_build_object('reason', p_reason));
end $$;

-- Reports and disputes, with what they point to.
create or replace function public.admin_reports(p_status text default 'open', p_kind text default '')
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
    select r.created_at, jsonb_build_object('id', r.id, 'kind', r.kind, 'target_id', r.target_id, 'reason', r.reason, 'details', r.details,
      'status', r.status, 'resolution', r.resolution, 'resolved_by', r.resolved_by, 'created_at', r.created_at, 'resolved_at', r.resolved_at,
      'reporter', jsonb_build_object('id', r.reporter_id, 'email', (select email from auth.users where id = r.reporter_id)),
      'shop', (select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug) from public.shops s where s.id = r.shop_id),
      'target', case r.kind
        when 'product' then (select jsonb_build_object('name', p.name, 'image', coalesce(p.images[1], ''), 'blocked', p.blocked) from public.products p where p.id = r.target_id)
        when 'order' then (select jsonb_build_object('name', o.number, 'status', o.status, 'payment_status', o.payment_status, 'total_dzd', o.total_dzd)
                           from public.orders o where o.id = r.target_id)
        else (select jsonb_build_object('name', s.name, 'suspended', s.suspended) from public.shops s where s.id = r.target_id) end,
      'shop_reports', (select count(*) from public.reports r2 where r2.shop_id = r.shop_id)) j
    from public.reports r
    where (coalesce(p_status, '') = '' or r.status = p_status) and (coalesce(p_kind, '') = '' or r.kind = p_kind)
    order by r.created_at desc limit 300) x), '[]'::jsonb);
end $$;

create or replace function public.admin_resolve_report(p_report bigint, p_status text, p_resolution text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
declare me text := public.admin_me();
begin
  perform public.require_admin();
  if p_status not in ('open', 'resolved', 'dismissed') then raise exception 'INVALID' using errcode = '22023'; end if;
  update public.reports set status = p_status, resolution = left(coalesce(p_resolution, ''), 1000), resolved_by = me,
    resolved_at = case when p_status = 'open' then null else now() end where id = p_report;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.admin_audit (admin_id, admin_email, action, target_type, target_id, details)
  values (auth.uid(), me, p_status, 'reports', p_report::text, jsonb_build_object('resolution', p_resolution));
end $$;

-- Listing review queue: new or edited products of shops not yet verified.
create or replace function public.admin_review_queue()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x.j order by x.updated) from (
    select p.created_at updated, jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description, 'story', p.story,
      'price_dzd', p.price_dzd, 'images', to_jsonb(p.images), 'category', p.category, 'subcategory', p.subcategory,
      'created_at', p.created_at, 'shop', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug)) j
    from public.products p join public.shops s on s.id = p.shop_id
    where p.reviewed_at is null and not p.blocked and s.status = 'approved' and not s.verified
    order by p.created_at limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_mark_reviewed(p_products uuid[])
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.products set reviewed_at = now() where id = any (p_products);
end $$;

create or replace function public.admin_block_products(p_products uuid[], p_reason text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
declare pid uuid;
begin
  perform public.require_admin();
  foreach pid in array p_products loop
    perform public.admin_set_product_blocked(pid, true, p_reason);
  end loop;
  update public.products set reviewed_at = now() where id = any (p_products);
end $$;

create or replace function public.admin_bulk_review_offers(p_entries bigint[], p_approve boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare e bigint;
begin
  perform public.require_admin();
  foreach e in array p_entries loop perform public.admin_review_offer_entry(e, p_approve, ''); end loop;
end $$;

-- Notes
create or replace function public.admin_notes(p_type text, p_target text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'admin_email', admin_email, 'body', body, 'created_at', created_at) order by created_at desc)
    from public.admin_notes where target_type = p_type and target_id = p_target), '[]'::jsonb);
end $$;

create or replace function public.admin_add_note(p_type text, p_target text, p_body text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  insert into public.admin_notes (target_type, target_id, admin_email, body) values (p_type, p_target, public.admin_me(), trim(p_body));
end $$;

-- Action log (optionally for one target)
create or replace function public.admin_audit_log(p_type text default '', p_target text default '', p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from (
    select * from public.admin_audit
    where (coalesce(p_type, '') = '' or target_type = p_type) and (coalesce(p_target, '') = '' or target_id = p_target)
    order by id desc limit least(greatest(p_limit, 1), 500)) a), '[]'::jsonb);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_me()', 'admin_counts()', 'admin_analytics(int)', 'admin_search(text)', 'admin_customers(text, text)', 'admin_customer(uuid)',
    'admin_set_user_blocked(uuid, boolean, text)', 'admin_reports(text, text)', 'admin_resolve_report(bigint, text, text)',
    'admin_review_queue()', 'admin_mark_reviewed(uuid[])', 'admin_block_products(uuid[], text)', 'admin_bulk_review_offers(bigint[], boolean)',
    'admin_notes(text, text)', 'admin_add_note(text, text, text)', 'admin_audit_log(text, text, int)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
