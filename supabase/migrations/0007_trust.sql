-- Trust: buyer reviews (only after delivery), verified shops, delivery price by zone.

-- ---------------------------------------------------------------- verified shops
-- Set by the Bledify team only (SQL editor / service role), never by the seller.
alter table public.shops add column if not exists verified boolean not null default false;
alter table public.shops add column if not exists verified_at timestamptz;

create or replace function public.shops_protect_verified()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.verified := false; new.verified_at := null;
    else
      new.verified := old.verified; new.verified_at := old.verified_at;
    end if;
  elsif new.verified and new.verified_at is null then
    new.verified_at := now();
  end if;
  return new;
end $$;
drop trigger if exists shops_protect_verified on public.shops;
create trigger shops_protect_verified before insert or update on public.shops
  for each row execute function public.shops_protect_verified();

-- ---------------------------------------------------------------- delivery zones
-- Zones: local (the shop's own wilaya), nord, hauts (Hauts-Plateaux), sud, grand_sud.
-- Same list as src/lib/delivery.ts (a test checks they agree).
create or replace function public.wilaya_code(p text)
returns int language sql immutable as $$
  select nullif(substring(coalesce(p, '') from '^\s*(\d{1,2})'), '')::int
$$;

create or replace function public.wilaya_zone(p_wilaya text, p_shop_wilaya text default null)
returns text language sql immutable as $$
  select case
    when public.wilaya_code(p_wilaya) is null then 'nord'
    when public.wilaya_code(p_wilaya) = public.wilaya_code(p_shop_wilaya) then 'local'
    when public.wilaya_code(p_wilaya) in (11, 33, 37, 50, 54, 56) then 'grand_sud'
    when public.wilaya_code(p_wilaya) in (1, 7, 8, 30, 39, 47, 49, 51, 52, 53, 55, 57, 58) then 'sud'
    when public.wilaya_code(p_wilaya) in (3, 4, 5, 12, 14, 17, 19, 20, 28, 32, 34, 38, 40, 45) then 'hauts'
    else 'nord' end
$$;

-- {zone: {home, desk, days_min, days_max, off}}; null = the flat delivery_home/desk fees everywhere.
create or replace function public.valid_delivery_zones(z jsonb)
returns boolean language plpgsql immutable as $$
declare k text; v jsonb;
begin
  if z is null then return true; end if;
  if jsonb_typeof(z) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(z) loop
    if k not in ('local', 'nord', 'hauts', 'sud', 'grand_sud') or jsonb_typeof(v) <> 'object' then return false; end if;
    if coalesce((v->>'off')::boolean, false) then continue; end if;
    if jsonb_typeof(v->'home') <> 'number' or jsonb_typeof(v->'desk') <> 'number' then return false; end if;
    if (v->>'home')::numeric not between 0 and 20000 or (v->>'desk')::numeric not between 0 and 20000 then return false; end if;
    if v ? 'days_min' and (jsonb_typeof(v->'days_min') <> 'number' or (v->>'days_min')::numeric not between 0 and 30) then return false; end if;
    if v ? 'days_max' and (jsonb_typeof(v->'days_max') <> 'number' or (v->>'days_max')::numeric not between 0 and 30) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

alter table public.shops add column if not exists delivery_zones jsonb;
alter table public.shops drop constraint if exists shops_delivery_zones_check;
alter table public.shops add constraint shops_delivery_zones_check check (public.valid_delivery_zones(delivery_zones));

-- Fees and delay for one wilaya: {zone, home, desk, days_min, days_max} or {zone, off: true}.
create or replace function public.delivery_quote(s public.shops, p_wilaya text)
returns jsonb language sql stable as $$
  with z as (select public.wilaya_zone(p_wilaya, s.wilaya) zone)
  select case
    when s.delivery_zones is null or not (s.delivery_zones ? z.zone) then
      jsonb_build_object('zone', z.zone, 'home', s.delivery_home_dzd, 'desk', s.delivery_desk_dzd)
    when coalesce((s.delivery_zones->z.zone->>'off')::boolean, false) then
      jsonb_build_object('zone', z.zone, 'off', true)
    else jsonb_build_object('zone', z.zone) || ((s.delivery_zones->z.zone) - 'off')
  end from z
$$;

-- ---------------------------------------------------------------- reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid references auth.users (id) on delete set null,
  author text not null default '',
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (length(comment) <= 600),
  hidden boolean not null default false,  -- moderation by the Bledify team
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc) where not hidden;
create index if not exists reviews_shop_idx on public.reviews (shop_id, created_at desc) where not hidden;
alter table public.reviews enable row level security;
-- no policies: read through the public functions, write through submit_review
revoke all on public.reviews from anon, authenticated;

-- "Amina Belkacem" -> "Amina B."
create or replace function public.short_name(n text)
returns text language sql immutable as $$
  select case when split_part(trim(n), ' ', 2) = '' then split_part(trim(n), ' ', 1)
    else split_part(trim(n), ' ', 1) || ' ' || upper(left(split_part(trim(n), ' ', 2), 1)) || '.' end
$$;

-- A buyer rates a product of one of their delivered orders (again = edit).
create or replace function public.submit_review(p_order uuid, p_product uuid, p_rating int, p_comment text default '')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  o public.orders;
  r public.reviews;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order and customer_id = auth.uid();
  if o.id is null then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if o.status <> 'delivered' then raise exception 'NOT_DELIVERED' using errcode = 'P0409'; end if;
  if not exists (select 1 from jsonb_array_elements(o.items) i where i->>'product_id' = p_product::text) then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING' using errcode = '22023'; end if;
  if not exists (select 1 from public.products where id = p_product) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.reviews (order_id, product_id, shop_id, customer_id, author, rating, comment)
  values (o.id, p_product, o.shop_id, auth.uid(), public.short_name(o.customer_name), p_rating,
          left(trim(coalesce(p_comment, '')), 600))
  on conflict (order_id, product_id) do update
    set rating = excluded.rating, comment = excluded.comment, updated_at = now()
  returning * into r;
  return jsonb_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment);
end $$;
revoke all on function public.submit_review(uuid, uuid, int, text) from public, anon;
grant execute on function public.submit_review(uuid, uuid, int, text) to authenticated;

create or replace function public.review_json(r public.reviews)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', r.id, 'author', r.author, 'rating', r.rating, 'comment', r.comment,
    'created_at', r.created_at, 'product_id', r.product_id)
$$;

-- ---------------------------------------------------------------- public reads
create or replace function public.product_card(p public.products, s public.shops)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'price_dzd', p.price_dzd,
    'image', coalesce(p.images[1], ''), 'category', p.category, 'tags', to_jsonb(p.tags),
    'shop_id', s.id, 'shop_name', s.name, 'shop_slug', s.slug, 'shop_wilaya', s.wilaya,
    'shop_verified', s.verified) || (
    select jsonb_build_object('rating', round(avg(r.rating), 1), 'review_count', count(*))
    from public.reviews r where r.product_id = p.id and not r.hidden)
$$;

create or replace function public.shop_rating(p_shop uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object('rating', round(avg(r.rating), 1), 'review_count', count(*))
  from public.reviews r where r.shop_id = p_shop and not r.hidden
$$;

create or replace function public.get_public_shop(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
    'wilaya', s.wilaya, 'whatsapp', s.whatsapp, 'verified', s.verified,
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
        'price_dzd', p.price_dzd, 'images', to_jsonb(p.images)) order by p.position, p.created_at)
      from public.products p where p.shop_id = s.id and p.active), '[]'::jsonb),
    'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered'),
    'reviews', coalesce((
      select jsonb_agg(x.j) from (
        select public.review_json(r) || jsonb_build_object('product_name', p.name) j
        from public.reviews r join public.products p on p.id = r.product_id
        where r.shop_id = s.id and not r.hidden order by r.created_at desc limit 6) x), '[]'::jsonb)
  ) || public.shop_rating(s.id)
  from public.shops s where s.slug = lower(p_slug)
$$;

create or replace function public.public_product(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'story', p.story, 'price_dzd', p.price_dzd,
    'images', to_jsonb(p.images), 'category', p.category, 'tags', to_jsonb(p.tags),
    'shop', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya,
      'description', s.description, 'delivery_home_dzd', s.delivery_home_dzd,
      'delivery_desk_dzd', s.delivery_desk_dzd, 'delivery_zones', s.delivery_zones, 'verified', s.verified,
      'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id),
      'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered'))
      || public.shop_rating(s.id),
    'reviews', coalesce((
      select jsonb_agg(x.j) from (
        select public.review_json(r) j from public.reviews r
        where r.product_id = p.id and not r.hidden order by r.created_at desc limit 20) x), '[]'::jsonb),
    'related', coalesce((
      select jsonb_agg(x.card) from (
        select public.product_card(p2, s) card from public.products p2
        where p2.shop_id = s.id and p2.active and p2.id <> p.id
        order by p2.position, p2.created_at limit 6) x), '[]'::jsonb)
  ) || (select jsonb_build_object('rating', round(avg(r.rating), 1), 'review_count', count(*))
        from public.reviews r where r.product_id = p.id and not r.hidden)
  from public.products p join public.shops s on s.id = p.shop_id
  where p.id = p_id and p.active
$$;

create or replace function public.public_cart(p_ids uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.product_card(p, s) || jsonb_build_object(
      'delivery_home_dzd', s.delivery_home_dzd, 'delivery_desk_dzd', s.delivery_desk_dzd,
      'delivery_zones', s.delivery_zones, 'shop_logo', s.logo, 'shop_logo_url', s.logo_url)), '[]'::jsonb)
  from public.products p join public.shops s on s.id = p.shop_id
  where p.id = any (p_ids[1:100]) and p.active
$$;

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
          'id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya, 'description', s.description,
          'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id), 'verified', s.verified,
          'cover', coalesce(nullif(s.cover_url, ''),
                   (select p.images[1] from public.products p
                    where p.shop_id = s.id and p.active and array_length(p.images, 1) > 0
                    order by p.position, p.created_at limit 1), ''),
          'product_count', (select count(*) from public.products p where p.shop_id = s.id and p.active),
          'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered')
        ) || public.shop_rating(s.id) shop,
        (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered') delivered
        from public.shops s
        where exists (select 1 from public.products p where p.shop_id = s.id and p.active)
        order by delivered desc limit 12
      ) x), '[]'::jsonb)
  )
$$;

-- A customer's own orders, with the ratings they already gave ({product_id: rating}).
create or replace function public.my_orders()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status, 'items', o.items,
    'total_dzd', o.total_dzd, 'created_at', o.created_at, 'carrier', o.carrier,
    'tracking_number', o.tracking_number, 'shop_name', s.name, 'shop_slug', s.slug,
    'image', (select p.images[1] from public.products p
              where p.id = (o.items->0->>'product_id')::uuid),
    'reviews', coalesce((select jsonb_object_agg(r.product_id, jsonb_build_object('rating', r.rating, 'comment', r.comment))
                         from public.reviews r where r.order_id = o.id), '{}'::jsonb)
  ) order by o.created_at desc), '[]'::jsonb)
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.customer_id = auth.uid() and auth.uid() is not null
$$;

-- ---------------------------------------------------------------- place_order with zone fees
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
  quote jsonb;
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

  quote := public.delivery_quote(s, p_wilaya);
  if coalesce((quote->>'off')::boolean, false) then raise exception 'NO_DELIVERY' using errcode = '22023'; end if;
  fee := (quote->>p_delivery_type)::int;

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

-- ---------------------------------------------------------------- demo data
-- Demo shops: verified (except one, to show both states) and zone prices.
update public.shops set verified = (slug <> 'petits-points-de-sarah') where is_demo;
update public.shops set
  delivery_zones = jsonb_build_object(
    'local',     jsonb_build_object('home', greatest(delivery_home_dzd - 200, 300), 'desk', greatest(delivery_desk_dzd - 100, 200), 'days_min', 1, 'days_max', 2),
    'nord',      jsonb_build_object('home', delivery_home_dzd, 'desk', delivery_desk_dzd, 'days_min', 2, 'days_max', 3),
    'hauts',     jsonb_build_object('home', delivery_home_dzd + 150, 'desk', delivery_desk_dzd + 100, 'days_min', 2, 'days_max', 4),
    'sud',       jsonb_build_object('home', delivery_home_dzd + 350, 'desk', delivery_desk_dzd + 250, 'days_min', 3, 'days_max', 6),
    'grand_sud', jsonb_build_object('home', delivery_home_dzd + 700, 'desk', delivery_desk_dzd + 500, 'days_min', 5, 'days_max', 9)),
  delivery_home_dzd = greatest(delivery_home_dzd - 200, 300),
  delivery_desk_dzd = greatest(delivery_desk_dzd - 100, 200)
where is_demo and delivery_zones is null;

-- Demo reviews on two thirds of the demo shops' delivered orders.
with o as (
  select o.*, row_number() over (order by o.number) rn
  from public.orders o join public.shops s on s.id = o.shop_id
  where s.is_demo and o.status = 'delivered' and jsonb_array_length(o.items) > 0
    and exists (select 1 from public.products p where p.id = (o.items->0->>'product_id')::uuid)
)
insert into public.reviews (order_id, product_id, shop_id, author, rating, comment, created_at, updated_at)
select o.id, (o.items->0->>'product_id')::uuid, o.shop_id, public.short_name(o.customer_name),
  case when o.rn % 9 = 4 then 4 when o.rn % 13 = 0 then 3 else 5 end,
  case when o.rn % 9 = 4 then 'Un peu de retard à la livraison, mais le produit est parfait.'
       when o.rn % 13 = 0 then 'Joli travail, mais la couleur est un peu différente de la photo.'
       else (array[
    'Exactement comme sur la photo, travail très soigné. Merci !',
    'بارك الله فيك، الخدمة نقية بزاف',
    'Livraison rapide et emballage soigné. Je recommande.',
    'وصلتني في الوقت والسلعة كيما في التصويرة، شكرا',
    'Elle m''a appelée pour confirmer avant d''envoyer, très sérieuse.',
    'Fait avec amour, ça se voit. Deuxième commande !',
    'Qualité au rendez-vous, toute la famille a adoré.',
    'ربي يبارك، منتوج تقليدي أصيل',
    '',
    'Très bon rapport qualité-prix.'])[1 + (o.rn % 10)::int] end,
  o.created_at + interval '4 days', o.created_at + interval '4 days'
from o where o.rn % 3 <> 0
on conflict (order_id, product_id) do nothing;
