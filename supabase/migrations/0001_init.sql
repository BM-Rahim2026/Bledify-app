-- Bledify schema: shops, products, COD orders with status history, call log,
-- risk flag, stats, public shop / order / tracking functions.
-- Every seller-owned row carries owner_id = auth.uid(); RLS enforces it.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  description text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  wilaya text not null default '',
  delivery_home_dzd integer not null default 600 check (delivery_home_dzd >= 0),
  delivery_desk_dzd integer not null default 400 check (delivery_desk_dzd >= 0),
  notify_email text not null default '',
  notify_new_orders boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  price_dzd integer not null check (price_dzd >= 0),
  images text[] not null default '{}',
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists products_shop_idx on public.products (shop_id, active, position);
create index if not exists products_owner_idx on public.products (owner_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_name text not null check (length(trim(customer_name)) between 2 and 80),
  phone text not null check (phone ~ '^0[5-7][0-9]{8}$'),
  wilaya text not null,
  commune text not null default '',
  address text not null default '',
  delivery_type text not null default 'home' check (delivery_type in ('home', 'desk')),
  -- [{product_id, name, unit_price_dzd, quantity}]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  delivery_dzd integer not null default 0 check (delivery_dzd >= 0),
  total_dzd integer not null default 0,
  note text not null default '',
  -- new, confirmed, shipped, delivered, cancelled, returned (+ legacy pending, ready)
  status text not null default 'new',
  -- [{status, at}] ; status "no_answer" marks an unanswered confirmation call
  history jsonb not null default '[]',
  no_answer_count integer not null default 0,
  carrier text not null default '',
  tracking_number text not null default '',
  source text not null default 'shop' check (source in ('shop', 'manual')),
  items_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_owner_status_idx on public.orders (owner_id, status, created_at desc);
create index if not exists orders_owner_phone_idx on public.orders (owner_id, phone);
create index if not exists orders_owner_created_idx on public.orders (owner_id, created_at desc);
create index if not exists orders_dup_idx on public.orders (shop_id, phone, created_at desc);

-- Rate-limit log for the public order endpoint (no RLS access for clients).
create table if not exists public.order_attempts (
  id bigserial primary key,
  ip text not null default '',
  phone text not null default '',
  at timestamptz not null default now()
);
create index if not exists order_attempts_ip_idx on public.order_attempts (ip, at desc);
create index if not exists order_attempts_phone_idx on public.order_attempts (phone, at desc);

-- ---------------------------------------------------------------- helpers

create or replace function public.normalize_dz_phone(p text)
returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g');
begin
  if d like '+213%' then d := '0' || substr(d, 5);
  elsif d like '00213%' then d := '0' || substr(d, 6);
  elsif d like '213%' and length(d) = 12 then d := '0' || substr(d, 4);
  elsif length(d) = 9 and d ~ '^[5-7]' then d := '0' || d;
  end if;
  if d ~ '^0[5-7][0-9]{8}$' then return d; end if;
  return null;
end $$;

create or replace function public.order_items_total(items jsonb)
returns integer language sql immutable as $$
  select coalesce(sum((coalesce(i->>'unit_price_dzd', '0'))::int * (coalesce(i->>'quantity', '0'))::int), 0)::int
  from jsonb_array_elements(coalesce(items, '[]'::jsonb)) i
$$;

create or replace function public.new_order_number()
returns text language plpgsql volatile as $$
declare n text;
begin
  loop
    n := 'BL-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.orders where number = n);
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- order trigger
-- Keeps status valid, writes history on every status change, recomputes totals.

create or replace function public.orders_before_write()
returns trigger language plpgsql as $$
declare
  settable constant text[] := array['new','confirmed','shipped','delivered','cancelled','returned'];
begin
  new.phone := coalesce(public.normalize_dz_phone(new.phone), new.phone);
  new.total_dzd := public.order_items_total(new.items) + coalesce(new.delivery_dzd, 0);

  if tg_op = 'INSERT' then
    if new.number is null or new.number = '' then new.number := public.new_order_number(); end if;
    if not (new.status = any (settable)) then
      raise exception 'Invalid status %', new.status using errcode = '22023';
    end if;
    if new.history is null or jsonb_array_length(new.history) = 0 then
      new.history := jsonb_build_array(jsonb_build_object('status', new.status, 'at', now()));
    end if;
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE
  new.id := old.id; new.owner_id := old.owner_id; new.shop_id := old.shop_id;
  new.number := old.number; new.created_at := old.created_at;
  if new.status is distinct from old.status then
    if not (new.status = any (settable)) then
      raise exception 'Invalid status %', new.status using errcode = '22023';
    end if;
    new.history := coalesce(old.history, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('status', new.status, 'at', now()));
  elsif new.history is distinct from old.history and current_setting('bledify.allow_history', true) is distinct from 'on' then
    -- history is append-only and written by the database
    new.history := old.history;
  end if;
  if current_setting('bledify.allow_history', true) is distinct from 'on' then
    new.no_answer_count := old.no_answer_count;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists orders_before_write on public.orders;
create trigger orders_before_write before insert or update on public.orders
  for each row execute function public.orders_before_write();

-- ---------------------------------------------------------------- RLS

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_attempts enable row level security;

drop policy if exists shops_owner_all on public.shops;
create policy shops_owner_all on public.shops for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists products_owner_all on public.products;
create policy products_owner_all on public.products for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
    and exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists orders_owner_all on public.orders;
create policy orders_owner_all on public.orders for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
    and exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- order_attempts: no policies = no client access.

-- Orders with the "Client à risque" flag: 2+ returned/cancelled orders from
-- the same phone at the same shop (other than this one).
create or replace view public.orders_view with (security_invoker = true) as
select o.*,
  (select count(*) from public.orders o2
     where o2.owner_id = o.owner_id and o2.phone = o.phone and o2.id <> o.id
       and o2.status in ('returned', 'cancelled')) >= 2 as risk
from public.orders o;

grant select on public.orders_view to authenticated;

-- ---------------------------------------------------------------- seller RPCs

-- Change status (optionally with carrier + tracking when shipping).
create or replace function public.set_order_status(
  p_order uuid, p_status text, p_carrier text default null, p_tracking text default null)
returns setof public.orders_view language plpgsql security invoker as $$
begin
  if p_status not in ('new','confirmed','shipped','delivered','cancelled','returned') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  update public.orders set
    status = p_status,
    carrier = case when p_status = 'shipped' and p_carrier is not null then trim(p_carrier) else carrier end,
    tracking_number = case when p_status = 'shipped' and p_tracking is not null then trim(p_tracking) else tracking_number end
  where id = p_order and owner_id = auth.uid();
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  return query select * from public.orders_view where id = p_order;
end $$;

-- Result of a confirmation call; only allowed on a "new" order.
create or replace function public.record_call(p_order uuid, p_result text)
returns setof public.orders_view language plpgsql security invoker as $$
declare cur text;
begin
  if p_result not in ('confirmed', 'no_answer', 'cancelled') then
    raise exception 'Invalid result' using errcode = '22023';
  end if;
  select status into cur from public.orders where id = p_order and owner_id = auth.uid() for update;
  if cur is null then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if cur <> 'new' then raise exception 'Call result only allowed on new orders' using errcode = 'P0409'; end if;
  if p_result = 'no_answer' then
    perform set_config('bledify.allow_history', 'on', true);
    update public.orders set
      no_answer_count = no_answer_count + 1,
      history = history || jsonb_build_array(jsonb_build_object('status', 'no_answer', 'at', now()))
    where id = p_order;
    perform set_config('bledify.allow_history', 'off', true);
  else
    update public.orders set status = p_result where id = p_order;
  end if;
  return query select * from public.orders_view where id = p_order;
end $$;

-- Stats in Algeria time (UTC+1, weeks start Monday).
create or replace function public.seller_stats()
returns jsonb language sql stable security invoker as $$
  with b as (
    select
      (date_trunc('week', now() at time zone 'Africa/Algiers')) at time zone 'Africa/Algiers' as week_start,
      (date_trunc('month', now() at time zone 'Africa/Algiers')) at time zone 'Africa/Algiers' as month_start
  ), o as (
    select * from public.orders where owner_id = auth.uid()
  ), c as (
    select
      count(*) filter (where created_at >= (select week_start from b)) as week,
      count(*) filter (where created_at >= (select month_start from b)) as month,
      count(*) filter (where status in ('new','confirmed','shipped','delivered','cancelled','returned')) as total,
      count(*) filter (where status in ('confirmed','shipped','delivered','returned')) as confirmed,
      count(*) filter (where status in ('shipped','delivered','returned')) as shipped,
      count(*) filter (where status = 'delivered') as delivered,
      count(*) filter (where status = 'returned') as returned,
      count(*) filter (where status = 'cancelled') as cancelled,
      count(*) filter (where status in ('new','pending')) as pending,
      coalesce(sum(total_dzd) filter (where status = 'delivered'), 0) as revenue,
      coalesce(sum(total_dzd) filter (where status = 'delivered' and created_at >= (select month_start from b)), 0) as revenue_month
    from o
  )
  select jsonb_build_object(
    'week', week, 'month', month, 'total', total, 'confirmed', confirmed,
    'shipped', shipped, 'delivered', delivered, 'returned', returned,
    'cancelled', cancelled, 'pending', pending,
    'revenue_dzd', revenue, 'revenue_month_dzd', revenue_month,
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                  from (select status, count(*) n from o group by status) s)
  ) from c
$$;

-- ---------------------------------------------------------------- public RPCs

-- Shop page data: safe shop fields + active products.
create or replace function public.get_public_shop(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
    'wilaya', s.wilaya, 'whatsapp', s.whatsapp,
    'delivery_home_dzd', s.delivery_home_dzd, 'delivery_desk_dzd', s.delivery_desk_dzd,
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description,
        'price_dzd', p.price_dzd, 'images', to_jsonb(p.images)) order by p.position, p.created_at)
      from public.products p where p.shop_id = s.id and p.active), '[]'::jsonb),
    'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered')
  )
  from public.shops s where s.slug = lower(p_slug)
$$;

-- Place a cash-on-delivery order. Called from the server route only
-- (service_role), which passes the caller's IP for rate limiting.
create or replace function public.place_order(
  p_slug text, p_customer_name text, p_phone text, p_wilaya text, p_commune text,
  p_address text, p_delivery_type text, p_items jsonb, p_note text default '', p_ip text default '')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.shops;
  ph text := public.normalize_dz_phone(p_phone);
  lines jsonb := '[]'::jsonb;
  it jsonb;
  pr public.products;
  qty int;
  hash text;
  fee int;
  o public.orders;
begin
  select * into s from public.shops where slug = lower(p_slug);
  if s.id is null then raise exception 'Shop not found' using errcode = 'P0002'; end if;
  if ph is null then raise exception 'INVALID_PHONE' using errcode = '22023'; end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'INVALID_NAME' using errcode = '22023'; end if;
  if length(trim(coalesce(p_wilaya, ''))) = 0 then raise exception 'INVALID_WILAYA' using errcode = '22023'; end if;
  if p_delivery_type not in ('home', 'desk') then raise exception 'INVALID_DELIVERY' using errcode = '22023'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  -- rate limits: 10 orders / hour per IP, 5 / hour per phone
  if coalesce(p_ip, '') <> '' and (select count(*) from public.order_attempts
      where ip = p_ip and at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;
  if (select count(*) from public.order_attempts where phone = ph and at > now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;

  -- prices always come from the database, never from the client
  for it in select * from jsonb_array_elements(p_items) loop
    qty := coalesce((it->>'quantity')::int, 0);
    if qty < 1 or qty > 99 then raise exception 'INVALID_ITEMS' using errcode = '22023'; end if;
    select * into pr from public.products
      where id = (it->>'product_id')::uuid and shop_id = s.id and active;
    if pr.id is null then raise exception 'INVALID_ITEMS' using errcode = '22023'; end if;
    lines := lines || jsonb_build_array(jsonb_build_object(
      'product_id', pr.id, 'name', pr.name, 'unit_price_dzd', pr.price_dzd, 'quantity', qty));
  end loop;

  select string_agg((l->>'product_id') || 'x' || (l->>'quantity'), ',' order by l->>'product_id')
    into hash from jsonb_array_elements(lines) l;

  -- same order (same shop, phone and items) blocked for 10 minutes
  if exists (select 1 from public.orders where shop_id = s.id and phone = ph and items_hash = hash
             and created_at > now() - interval '10 minutes') then
    raise exception 'DUPLICATE_ORDER' using errcode = 'P0409';
  end if;

  insert into public.order_attempts (ip, phone) values (coalesce(p_ip, ''), ph);

  fee := case when p_delivery_type = 'desk' then s.delivery_desk_dzd else s.delivery_home_dzd end;

  insert into public.orders (owner_id, shop_id, customer_name, phone, wilaya, commune, address,
      delivery_type, items, delivery_dzd, note, status, source, items_hash)
  values (s.owner_id, s.id, trim(p_customer_name), ph, trim(p_wilaya), trim(coalesce(p_commune, '')),
      trim(coalesce(p_address, '')), p_delivery_type, lines, fee, left(coalesce(p_note, ''), 500),
      'new', 'shop', hash)
  returning * into o;

  return jsonb_build_object('id', o.id, 'number', o.number, 'total_dzd', o.total_dzd,
    'delivery_dzd', o.delivery_dzd, 'items', o.items, 'shop_name', s.name);
end $$;

-- Customer order tracking: order number + phone.
create or replace function public.track_order(p_number text, p_phone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'number', o.number, 'status', o.status, 'history', o.history,
    'carrier', o.carrier, 'tracking_number', o.tracking_number,
    'items', o.items, 'delivery_dzd', o.delivery_dzd, 'total_dzd', o.total_dzd,
    'wilaya', o.wilaya, 'commune', o.commune, 'delivery_type', o.delivery_type,
    'created_at', o.created_at, 'shop_name', s.name, 'shop_slug', s.slug)
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.number = upper(trim(p_number)) and o.phone = public.normalize_dz_phone(p_phone)
$$;

-- Owner email for new-order alerts (server route, service_role only).
create or replace function public.order_alert_target(p_order uuid)
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'email', coalesce(nullif(s.notify_email, ''), u.email),
    'enabled', s.notify_new_orders, 'shop_name', s.name,
    'language', coalesce(u.raw_user_meta_data->>'language', 'fr'))
  from public.orders o join public.shops s on s.id = o.shop_id join auth.users u on u.id = s.owner_id
  where o.id = p_order
$$;

-- ---------------------------------------------------------------- grants

revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.order_alert_target(uuid) from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function public.order_alert_target(uuid) to service_role;
grant execute on function public.get_public_shop(text) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.set_order_status(uuid, text, text, text) to authenticated;
grant execute on function public.record_call(uuid, text) to authenticated;
grant execute on function public.seller_stats() to authenticated;
revoke all on function public.set_order_status(uuid, text, text, text) from anon;
revoke all on function public.record_call(uuid, text) from anon;
revoke all on function public.seller_stats() from anon;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "product images owner insert" on storage.objects;
create policy "product images owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "product images owner update" on storage.objects;
create policy "product images owner update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "product images owner delete" on storage.objects;
create policy "product images owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
