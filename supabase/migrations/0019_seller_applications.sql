-- Seller access by application: anyone can apply (create a shop), the team approves.
-- A shop and its products stay invisible until approved. Existing shops are approved.
alter table public.shops add column if not exists status text not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));
alter table public.shops alter column status set default 'pending';
alter table public.shops add column if not exists application_note text not null default '' check (length(application_note) <= 1000);
alter table public.shops add column if not exists review_note text not null default '';
alter table public.shops add column if not exists reviewed_at timestamptz;

-- Shops cannot approve themselves; a refused applicant who updates the application goes back to review.
create or replace function public.shops_protect_status()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.review_note := ''; new.reviewed_at := null;
    else
      new.review_note := old.review_note; new.reviewed_at := old.reviewed_at;
      new.status := case when old.status = 'rejected' and new.application_note is distinct from old.application_note
                         then 'pending' else old.status end;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists shops_protect_status on public.shops;
create trigger shops_protect_status before insert or update on public.shops
  for each row execute function public.shops_protect_status();

-- products of a shop that is not approved (or suspended) are never shown
create or replace function public.products_moderation()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.blocked := false; new.block_reason := '';
    else new.blocked := old.blocked; new.block_reason := old.block_reason; end if;
    new.seller_active := new.active;
  end if;
  if new.blocked or exists (select 1 from public.shops s where s.id = new.shop_id and (s.suspended or s.status <> 'approved')) then
    new.active := false;
  end if;
  return new;
end $$;

create or replace function public.get_public_shop(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
    'wilaya', s.wilaya, 'verified', s.verified,
    'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id),
    'delivery_home_dzd', s.delivery_home_dzd, 'delivery_desk_dzd', s.delivery_desk_dzd,
    'delivery_zones', s.delivery_zones,
    'cover', coalesce(nullif(s.cover_url, ''),
             (select p.images[1] from public.products p
              where p.shop_id = s.id and p.active and array_length(p.images, 1) > 0
              order by p.position, p.created_at limit 1), ''),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description, 'category', p.category,
        'price_dzd', p.price_dzd, 'images', to_jsonb(p.images),
        'pay_cod', p.pay_cod, 'pay_card', p.pay_card, 'deposit_pct', p.deposit_pct) order by p.position, p.created_at)
      from public.products p where p.shop_id = s.id and p.active), '[]'::jsonb),
    'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered'),
    'reviews', coalesce((
      select jsonb_agg(x.j) from (
        select public.review_json(r) || jsonb_build_object('product_name', p.name) j
        from public.reviews r join public.products p on p.id = r.product_id
        where r.shop_id = s.id and not r.hidden order by r.created_at desc limit 6) x), '[]'::jsonb)
  ) || public.shop_rating(s.id)
  from public.shops s where s.slug = lower(p_slug) and s.status = 'approved' and not s.suspended
$$;

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
    'reviews_7d', (select count(*) from public.reviews where created_at > now() - interval '7 days'),
    'applications', (select count(*) from public.shops where status = 'pending'));
end $$;

create or replace function public.admin_shops(p_q text default '', p_filter text default '')
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
    select s.created_at, jsonb_build_object(
      'id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya, 'verified', s.verified,
      'suspended', s.suspended, 'is_demo', s.is_demo, 'status', s.status, 'created_at', s.created_at, 'email', u.email,
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
           or (p_filter = 'demo' and s.is_demo)
           or (p_filter = 'pending' and s.status = 'pending')
           or (p_filter = 'rejected' and s.status = 'rejected'))
    order by s.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_update_shop(p_shop uuid, p_patch jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare susp boolean; st text;
begin
  perform public.require_admin();
  update public.shops set
    verified = coalesce((p_patch->>'verified')::boolean, verified),
    suspended = coalesce((p_patch->>'suspended')::boolean, suspended),
    suspended_reason = case when p_patch ? 'suspended_reason' then left(coalesce(p_patch->>'suspended_reason', ''), 300) else suspended_reason end,
    commission_pct = case when p_patch ? 'commission_pct' then nullif(p_patch->>'commission_pct', '')::numeric else commission_pct end,
    status = coalesce(p_patch->>'status', status),
    review_note = case when p_patch ? 'review_note' then left(coalesce(p_patch->>'review_note', ''), 300) else review_note end,
    reviewed_at = case when p_patch ? 'status' then now() else reviewed_at end
  where id = p_shop returning suspended, status into susp, st;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  -- products follow the shop: hidden while suspended, back to the shop's own choice afterwards
  update public.products set active = (not susp) and st = 'approved' and coalesce(seller_active, true) and not blocked where shop_id = p_shop;
end $$;
