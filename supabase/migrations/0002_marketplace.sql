-- Marketplace: product categories, shop covers, customer accounts on orders,
-- public browse functions. Buying now requires a signed-in customer.

-- ---------------------------------------------------------------- columns

alter table public.products add column if not exists category text not null default 'artisanat';
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('gateaux','cuisine','terroir','couture','enfants','artisanat','beaute','bijoux'));
create index if not exists products_category_idx on public.products (category, active, created_at desc);

alter table public.shops add column if not exists cover_url text not null default '';
alter table public.shops add column if not exists is_demo boolean not null default false;

alter table public.orders add column if not exists customer_id uuid references auth.users (id) on delete set null;
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);

-- ---------------------------------------------------------------- helpers

create or replace function public.product_card(p public.products, s public.shops)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'price_dzd', p.price_dzd,
    'image', coalesce(p.images[1], ''), 'category', p.category,
    'shop_name', s.name, 'shop_slug', s.slug, 'shop_wilaya', s.wilaya)
$$;

-- ---------------------------------------------------------------- public browse

create or replace function public.public_home()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.category, 'count', c.n, 'image', c.image) order by c.n desc)
      from (
        select p.category, count(*) n,
          (array_agg(p.images[1] order by p.created_at) filter (where array_length(p.images, 1) > 0))[1] image
        from public.products p where p.active group by p.category
      ) c), '[]'::jsonb),
    'featured', coalesce((
      select jsonb_agg(x.card) from (
        select public.product_card(p, s) card
        from public.products p join public.shops s on s.id = p.shop_id
        where p.active and array_length(p.images, 1) > 0
        order by md5(p.id::text || current_date::text) limit 12
      ) x), '[]'::jsonb),
    'shops', coalesce((
      select jsonb_agg(x.shop order by x.delivered desc) from (
        select jsonb_build_object(
          'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya, 'description', s.description,
          'cover', coalesce(nullif(s.cover_url, ''),
                   (select p.images[1] from public.products p
                    where p.shop_id = s.id and p.active and array_length(p.images, 1) > 0
                    order by p.position, p.created_at limit 1), ''),
          'product_count', (select count(*) from public.products p where p.shop_id = s.id and p.active),
          'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered')
        ) shop,
        (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered') delivered
        from public.shops s
        where exists (select 1 from public.products p where p.shop_id = s.id and p.active)
        order by delivered desc limit 12
      ) x), '[]'::jsonb)
  )
$$;

create or replace function public.public_products(
  p_category text default null, p_q text default null, p_limit int default 24, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.card), '[]'::jsonb) from (
    select public.product_card(p, s) card
    from public.products p join public.shops s on s.id = p.shop_id
    where p.active
      and (p_category is null or p_category = '' or p.category = p_category)
      and (p_q is null or p_q = '' or p.name ilike '%' || p_q || '%'
           or p.description ilike '%' || p_q || '%' or s.name ilike '%' || p_q || '%')
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
  ) x
$$;

create or replace function public.public_product(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'price_dzd', p.price_dzd,
    'images', to_jsonb(p.images), 'category', p.category,
    'shop', jsonb_build_object('name', s.name, 'slug', s.slug, 'wilaya', s.wilaya,
      'description', s.description, 'delivery_home_dzd', s.delivery_home_dzd,
      'delivery_desk_dzd', s.delivery_desk_dzd,
      'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered')),
    'related', coalesce((
      select jsonb_agg(x.card) from (
        select public.product_card(p2, s) card from public.products p2
        where p2.shop_id = s.id and p2.active and p2.id <> p.id
        order by p2.position, p2.created_at limit 6) x), '[]'::jsonb)
  )
  from public.products p join public.shops s on s.id = p.shop_id
  where p.id = p_id and p.active
$$;

create or replace function public.get_public_shop(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
    'wilaya', s.wilaya, 'whatsapp', s.whatsapp,
    'delivery_home_dzd', s.delivery_home_dzd, 'delivery_desk_dzd', s.delivery_desk_dzd,
    'cover', coalesce(nullif(s.cover_url, ''),
             (select p.images[1] from public.products p
              where p.shop_id = s.id and p.active and array_length(p.images, 1) > 0
              order by p.position, p.created_at limit 1), ''),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description, 'category', p.category,
        'price_dzd', p.price_dzd, 'images', to_jsonb(p.images)) order by p.position, p.created_at)
      from public.products p where p.shop_id = s.id and p.active), '[]'::jsonb),
    'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered')
  )
  from public.shops s where s.slug = lower(p_slug)
$$;

-- ---------------------------------------------------------------- orders

-- place_order now records the signed-in customer.
drop function if exists public.place_order(text, text, text, text, text, text, text, jsonb, text, text);

create or replace function public.place_order(
  p_slug text, p_customer_name text, p_phone text, p_wilaya text, p_commune text,
  p_address text, p_delivery_type text, p_items jsonb, p_note text default '', p_ip text default '',
  p_customer uuid default null)
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

  if coalesce(p_ip, '') <> '' and (select count(*) from public.order_attempts
      where ip = p_ip and at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;
  if (select count(*) from public.order_attempts where phone = ph and at > now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;

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

  if exists (select 1 from public.orders where shop_id = s.id and phone = ph and items_hash = hash
             and created_at > now() - interval '10 minutes') then
    raise exception 'DUPLICATE_ORDER' using errcode = 'P0409';
  end if;

  insert into public.order_attempts (ip, phone) values (coalesce(p_ip, ''), ph);

  fee := case when p_delivery_type = 'desk' then s.delivery_desk_dzd else s.delivery_home_dzd end;

  insert into public.orders (owner_id, shop_id, customer_id, customer_name, phone, wilaya, commune, address,
      delivery_type, items, delivery_dzd, note, status, source, items_hash)
  values (s.owner_id, s.id, p_customer, trim(p_customer_name), ph, trim(p_wilaya), trim(coalesce(p_commune, '')),
      trim(coalesce(p_address, '')), p_delivery_type, lines, fee, left(coalesce(p_note, ''), 500),
      'new', 'shop', hash)
  returning * into o;

  return jsonb_build_object('id', o.id, 'number', o.number, 'total_dzd', o.total_dzd,
    'delivery_dzd', o.delivery_dzd, 'items', o.items, 'shop_name', s.name);
end $$;

revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb, text, text, uuid) to service_role;

-- A customer's own orders (limited fields).
create or replace function public.my_orders()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status, 'items', o.items,
    'total_dzd', o.total_dzd, 'created_at', o.created_at, 'carrier', o.carrier,
    'tracking_number', o.tracking_number, 'shop_name', s.name, 'shop_slug', s.slug,
    'image', (select p.images[1] from public.products p
              where p.id = (o.items->0->>'product_id')::uuid)
  ) order by o.created_at desc), '[]'::jsonb)
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.customer_id = auth.uid() and auth.uid() is not null
$$;

grant execute on function public.public_home() to anon, authenticated;
grant execute on function public.public_products(text, text, int, int) to anon, authenticated;
grant execute on function public.public_product(uuid) to anon, authenticated;
grant execute on function public.get_public_shop(text) to anon, authenticated;
revoke all on function public.my_orders() from anon;
grant execute on function public.my_orders() to authenticated;
