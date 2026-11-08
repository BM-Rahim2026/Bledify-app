-- Admin console: moderation (suspended shops, blocked products, hidden reviews) and the admin
-- functions behind /admin. Every admin_* function checks is_admin() itself.

-- ---------------------------------------------------------------- moderation fields
alter table public.shops add column if not exists suspended boolean not null default false;
alter table public.shops add column if not exists suspended_reason text not null default '';
alter table public.products add column if not exists blocked boolean not null default false;
alter table public.products add column if not exists block_reason text not null default '';
-- what the shop wants (visible or not); "active" = shown, forced off while blocked or suspended
alter table public.products add column if not exists seller_active boolean;
update public.products set seller_active = active where seller_active is null;
alter table public.products alter column seller_active set default true;

-- Team-only shop fields: suspended, commission, demo flag.
create or replace function public.shops_protect_admin_fields()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.suspended := false; new.suspended_reason := ''; new.commission_pct := null; new.is_demo := false;
    else
      new.suspended := old.suspended; new.suspended_reason := old.suspended_reason;
      new.commission_pct := old.commission_pct; new.is_demo := old.is_demo;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists shops_protect_admin_fields on public.shops;
create trigger shops_protect_admin_fields before insert or update on public.shops
  for each row execute function public.shops_protect_admin_fields();

-- Products: shops cannot unblock; a blocked product or a suspended shop's product is never shown.
create or replace function public.products_moderation()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.blocked := false; new.block_reason := '';
    else new.blocked := old.blocked; new.block_reason := old.block_reason; end if;
    new.seller_active := new.active;
  end if;
  if new.blocked or exists (select 1 from public.shops s where s.id = new.shop_id and s.suspended) then
    new.active := false;
  end if;
  return new;
end $$;
drop trigger if exists products_moderation on public.products;
create trigger products_moderation before insert or update on public.products
  for each row execute function public.products_moderation();

-- ---------------------------------------------------------------- dashboard
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'orders_today', (select count(*) from public.orders where source = 'shop' and payment_status not in ('pending', 'failed')
                      and created_at >= date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers'),
    'orders_7d', (select count(*) from public.orders where source = 'shop' and payment_status not in ('pending', 'failed') and created_at > now() - interval '7 days'),
    'orders_30d', (select count(*) from public.orders where source = 'shop' and payment_status not in ('pending', 'failed') and created_at > now() - interval '30 days'),
    'gmv_30d', (select coalesce(sum(total_dzd), 0) from public.orders where source = 'shop' and status = 'delivered' and updated_at > now() - interval '30 days'),
    'commission_30d', (select coalesce(sum(commission_dzd), 0) from public.orders where source = 'shop' and status = 'delivered' and updated_at > now() - interval '30 days'),
    'by_status_30d', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.orders
        where source = 'shop' and payment_status not in ('pending', 'failed') and created_at > now() - interval '30 days' group by status) x), '{}'::jsonb),
    'shops_total', (select count(*) from public.shops),
    'shops_verified', (select count(*) from public.shops where verified),
    'shops_suspended', (select count(*) from public.shops where suspended),
    'shops_new_7d', (select count(*) from public.shops where created_at > now() - interval '7 days'),
    'products_active', (select count(*) from public.products where active),
    'products_blocked', (select count(*) from public.products where blocked),
    'customers', (select count(distinct customer_id) from public.orders where customer_id is not null),
    'users', (select count(*) from auth.users),
    'pending_offers', (select count(*) from public.offer_entries where status = 'pending'),
    'refunds_due', (select count(*) from public.orders where payment_status = 'refund_due'),
    'payouts_due', (select coalesce(sum(a), 0) from (select sum(amount_dzd) a from public.seller_ledger where available_at <= now() group by shop_id) x where a > 0),
    'unverified_shops', (select count(*) from public.shops s where not s.verified and not s.suspended
                          and exists (select 1 from public.products p where p.shop_id = s.id)),
    'reviews_7d', (select count(*) from public.reviews where created_at > now() - interval '7 days'));
end $$;

-- ---------------------------------------------------------------- shops
create or replace function public.admin_shops(p_q text default '', p_filter text default '')
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
    select s.created_at, jsonb_build_object(
      'id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya, 'verified', s.verified,
      'suspended', s.suspended, 'is_demo', s.is_demo, 'created_at', s.created_at, 'email', u.email,
      'phone', s.phone, 'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id),
      'products', (select count(*) from public.products p where p.shop_id = s.id),
      'orders', (select count(*) from public.orders o where o.shop_id = s.id and o.payment_status not in ('pending', 'failed')),
      'delivered', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered')) j
    from public.shops s join auth.users u on u.id = s.owner_id
    where (coalesce(p_q, '') = '' or s.name ilike '%' || p_q || '%' or s.slug ilike '%' || p_q || '%'
           or u.email ilike '%' || p_q || '%' or s.phone like '%' || p_q || '%')
      and (coalesce(p_filter, '') = ''
           or (p_filter = 'unverified' and not s.verified)
           or (p_filter = 'verified' and s.verified)
           or (p_filter = 'suspended' and s.suspended)
           or (p_filter = 'demo' and s.is_demo))
    order by s.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_shop(p_shop uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return (select to_jsonb(s) - 'notify_email' || jsonb_build_object(
      'email', u.email, 'owner_name', u.raw_user_meta_data->>'full_name', 'category', public.shop_category(s.id),
      'commission_effective', coalesce(s.commission_pct, (select commission_pct from public.platform_settings)),
      'products', (select count(*) from public.products p where p.shop_id = s.id),
      'products_blocked', (select count(*) from public.products p where p.shop_id = s.id and p.blocked),
      'orders', (select count(*) from public.orders o where o.shop_id = s.id and o.payment_status not in ('pending', 'failed')),
      'delivered', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered'),
      'returned', (select count(*) from public.orders o where o.shop_id = s.id and o.status in ('returned', 'cancelled')),
      'sales_dzd', (select coalesce(sum(total_dzd), 0) from public.orders o where o.shop_id = s.id and o.status = 'delivered'),
      'available', (select coalesce(sum(amount_dzd), 0) from public.seller_ledger l where l.shop_id = s.id and l.available_at <= now()),
      'on_hold', (select coalesce(sum(amount_dzd), 0) from public.seller_ledger l where l.shop_id = s.id and l.available_at > now() and l.kind <> 'payout'),
      'paid_out', (select coalesce(-sum(amount_dzd), 0) from public.seller_ledger l where l.shop_id = s.id and l.kind = 'payout'))
      || public.shop_rating(s.id)
    from public.shops s join auth.users u on u.id = s.owner_id where s.id = p_shop);
end $$;

-- p_patch keys: verified, suspended, suspended_reason, commission_pct (null = platform default)
create or replace function public.admin_update_shop(p_shop uuid, p_patch jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare susp boolean;
begin
  perform public.require_admin();
  update public.shops set
    verified = coalesce((p_patch->>'verified')::boolean, verified),
    suspended = coalesce((p_patch->>'suspended')::boolean, suspended),
    suspended_reason = case when p_patch ? 'suspended_reason' then left(coalesce(p_patch->>'suspended_reason', ''), 300) else suspended_reason end,
    commission_pct = case when p_patch ? 'commission_pct' then nullif(p_patch->>'commission_pct', '')::numeric else commission_pct end
  where id = p_shop returning suspended into susp;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  -- products follow the shop: hidden while suspended, back to the shop's own choice afterwards
  update public.products set active = (not susp) and coalesce(seller_active, true) and not blocked where shop_id = p_shop;
end $$;

-- ---------------------------------------------------------------- products
create or replace function public.admin_products(p_q text default '', p_category text default '', p_filter text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
    select p.created_at, jsonb_build_object(
      'id', p.id, 'name', p.name, 'price_dzd', p.price_dzd, 'image', coalesce(p.images[1], ''),
      'category', p.category, 'subcategory', p.subcategory, 'active', p.active, 'seller_active', p.seller_active,
      'blocked', p.blocked, 'block_reason', p.block_reason, 'created_at', p.created_at,
      'shop', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'suspended', s.suspended)) j
    from public.products p join public.shops s on s.id = p.shop_id
    where (coalesce(p_q, '') = '' or p.name ilike '%' || p_q || '%' or s.name ilike '%' || p_q || '%')
      and (coalesce(p_category, '') = '' or p.category = p_category)
      and (coalesce(p_filter, '') = ''
           or (p_filter = 'blocked' and p.blocked)
           or (p_filter = 'hidden' and not p.active and not p.blocked)
           or (p_filter = 'visible' and p.active))
    order by p.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_set_product_blocked(p_product uuid, p_blocked boolean, p_reason text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.products p set blocked = p_blocked, block_reason = case when p_blocked then left(coalesce(p_reason, ''), 300) else '' end,
    active = (not p_blocked) and coalesce(p.seller_active, true)
      and not exists (select 1 from public.shops s where s.id = p.shop_id and s.suspended)
  where p.id = p_product;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
end $$;

-- ---------------------------------------------------------------- orders
create or replace function public.admin_orders(p_q text default '', p_status text default '', p_payment text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
    select o.created_at, jsonb_build_object(
      'id', o.id, 'number', o.number, 'status', o.status, 'payment_status', o.payment_status,
      'payment_method', o.payment_method, 'total_dzd', o.total_dzd, 'amount_online_dzd', o.amount_online_dzd,
      'customer_name', o.customer_name, 'phone', o.phone, 'wilaya', o.wilaya, 'created_at', o.created_at,
      'source', o.source, 'items_count', jsonb_array_length(o.items),
      'shop', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug)) j
    from public.orders o join public.shops s on s.id = o.shop_id
    where (coalesce(p_q, '') = '' or o.number ilike '%' || p_q || '%' or o.customer_name ilike '%' || p_q || '%'
           or o.phone like '%' || regexp_replace(p_q, '\D', '', 'g') || '%' and regexp_replace(p_q, '\D', '', 'g') <> ''
           or s.name ilike '%' || p_q || '%')
      and (coalesce(p_status, '') = '' or o.status = p_status)
      and (coalesce(p_payment, '') = '' or o.payment_status = p_payment)
    order by o.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_order(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return (select to_jsonb(o) - 'items_hash' || jsonb_build_object(
      'shop', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'phone', s.phone, 'wilaya', s.wilaya),
      'customer_email', (select email from auth.users where id = o.customer_id),
      'ledger', coalesce((select jsonb_agg(jsonb_build_object('kind', l.kind, 'amount_dzd', l.amount_dzd, 'available_at', l.available_at,
          'created_at', l.created_at) order by l.id) from public.seller_ledger l where l.order_id = o.id), '[]'::jsonb))
    from public.orders o join public.shops s on s.id = o.shop_id where o.id = p_order);
end $$;

create or replace function public.admin_resolve_refund(p_order uuid, p_shop_credit int default 0, p_note text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  perform public.resolve_refund(p_order, p_shop_credit, p_note);
end $$;

-- ---------------------------------------------------------------- payments
create or replace function public.admin_payouts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'payouts', coalesce((select jsonb_agg(x.j order by x.available desc) from (
      select b.available, jsonb_build_object('shop_id', s.id, 'name', s.name, 'slug', s.slug, 'available', b.available,
        'on_hold', b.on_hold, 'payout_method', s.payout_method, 'payout_account', s.payout_account, 'payout_holder', s.payout_holder) j
      from public.shops s join (
        select shop_id, sum(amount_dzd) filter (where available_at <= now()) available,
               sum(amount_dzd) filter (where available_at > now() and kind <> 'payout') on_hold
        from public.seller_ledger group by shop_id) b on b.shop_id = s.id
      where coalesce(b.available, 0) > 0 or coalesce(b.on_hold, 0) > 0) x), '[]'::jsonb),
    'refunds', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'status', o.status,
        'amount_online_dzd', o.amount_online_dzd, 'payment_method', o.payment_method, 'customer_name', o.customer_name,
        'phone', o.phone, 'shop_name', s.name, 'updated_at', o.updated_at) order by o.updated_at)
      from public.orders o join public.shops s on s.id = o.shop_id where o.payment_status = 'refund_due'), '[]'::jsonb),
    'recent_payouts', coalesce((select jsonb_agg(jsonb_build_object('shop', s.name, 'amount_dzd', -l.amount_dzd, 'note', l.note,
        'created_at', l.created_at) order by l.created_at desc)
      from (select * from public.seller_ledger where kind = 'payout' order by created_at desc limit 30) l
      join public.shops s on s.id = l.shop_id), '[]'::jsonb));
end $$;

create or replace function public.admin_record_payout(p_shop uuid, p_amount int, p_reference text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  perform public.record_payout(p_shop, p_amount, left(coalesce(p_reference, ''), 120));
end $$;

-- ---------------------------------------------------------------- reviews
create or replace function public.admin_reviews(p_filter text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
    select r.created_at, jsonb_build_object('id', r.id, 'author', r.author, 'rating', r.rating, 'comment', r.comment,
      'hidden', r.hidden, 'created_at', r.created_at, 'product', jsonb_build_object('id', p.id, 'name', p.name),
      'shop', jsonb_build_object('name', s.name, 'slug', s.slug)) j
    from public.reviews r join public.products p on p.id = r.product_id join public.shops s on s.id = r.shop_id
    where coalesce(p_filter, '') = '' or (p_filter = 'hidden' and r.hidden) or (p_filter = 'low' and r.rating <= 2)
    order by r.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_set_review_hidden(p_review uuid, p_hidden boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.reviews set hidden = p_hidden where id = p_review;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
end $$;

-- ---------------------------------------------------------------- settings and admins
create or replace function public.admin_settings()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return (select to_jsonb(ps) - 'id' from public.platform_settings ps) || jsonb_build_object(
    'admins', coalesce((select jsonb_agg(jsonb_build_object('email', u.email, 'since', a.created_at) order by a.created_at)
      from public.admins a join auth.users u on u.id = a.user_id), '[]'::jsonb),
    'admin_emails', coalesce((select jsonb_agg(jsonb_build_object('email', e.email,
        'confirmed', exists (select 1 from auth.users u where lower(u.email) = e.email and u.email_confirmed_at is not null))
      order by e.created_at) from public.admin_emails e), '[]'::jsonb),
    'me', (select email from auth.users where id = auth.uid()));
end $$;

create or replace function public.admin_save_settings(p_settings jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.platform_settings set
    commission_pct = coalesce((p_settings->>'commission_pct')::numeric, commission_pct),
    payout_delay_days = coalesce((p_settings->>'payout_delay_days')::int, payout_delay_days),
    unpaid_expiry_minutes = coalesce((p_settings->>'unpaid_expiry_minutes')::int, unpaid_expiry_minutes);
end $$;

create or replace function public.admin_add_admin_email(p_email text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  insert into public.admin_emails (email) values (lower(trim(p_email))) on conflict do nothing;
end $$;

-- removes an email and the matching account's admin row (an admin cannot remove themself)
create or replace function public.admin_remove_admin_email(p_email text)
returns void language plpgsql volatile security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  if lower(trim(p_email)) = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'CANNOT_REMOVE_SELF' using errcode = '22023';
  end if;
  delete from public.admin_emails where email = lower(trim(p_email));
  delete from public.admins a using auth.users u where u.id = a.user_id and lower(u.email) = lower(trim(p_email));
end $$;

-- ---------------------------------------------------------------- grants
do $$
declare f text;
begin
  foreach f in array array[
    'admin_dashboard()', 'admin_shops(text, text)', 'admin_shop(uuid)', 'admin_update_shop(uuid, jsonb)',
    'admin_products(text, text, text)', 'admin_set_product_blocked(uuid, boolean, text)',
    'admin_orders(text, text, text)', 'admin_order(uuid)', 'admin_resolve_refund(uuid, int, text)',
    'admin_payouts()', 'admin_record_payout(uuid, int, text)', 'admin_reviews(text)', 'admin_set_review_hidden(uuid, boolean)',
    'admin_settings()', 'admin_save_settings(jsonb)', 'admin_add_admin_email(text)', 'admin_remove_admin_email(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
