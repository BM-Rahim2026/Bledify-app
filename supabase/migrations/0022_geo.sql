-- Location: buyers see the nearest shops first. Shops only give their wilaya, so distance is
-- measured between wilaya capitals (src/lib/geo-coords.ts mirrors this table; a test checks).

create table if not exists public.wilaya_coords (
  code int primary key check (code between 1 and 99),
  lat double precision not null,
  lng double precision not null
);
alter table public.wilaya_coords enable row level security;
drop policy if exists wilaya_coords_read on public.wilaya_coords;
create policy wilaya_coords_read on public.wilaya_coords for select to anon, authenticated using (true);
revoke all on public.wilaya_coords from anon, authenticated;
grant select on public.wilaya_coords to anon, authenticated;
insert into public.wilaya_coords (code, lat, lng) values
  (1, 27.874, -0.294),
  (2, 36.165, 1.334),
  (3, 33.800, 2.865),
  (4, 35.877, 7.113),
  (5, 35.556, 6.174),
  (6, 36.751, 5.056),
  (7, 34.851, 5.728),
  (8, 31.617, -2.217),
  (9, 36.470, 2.828),
  (10, 36.375, 3.902),
  (11, 22.785, 5.523),
  (12, 35.404, 8.124),
  (13, 34.878, -1.315),
  (14, 35.371, 1.317),
  (15, 36.712, 4.046),
  (16, 36.754, 3.059),
  (17, 34.673, 3.263),
  (18, 36.821, 5.766),
  (19, 36.190, 5.414),
  (20, 34.831, 0.152),
  (21, 36.876, 6.907),
  (22, 35.190, -0.631),
  (23, 36.900, 7.766),
  (24, 36.462, 7.426),
  (25, 36.365, 6.615),
  (26, 36.264, 2.754),
  (27, 35.931, 0.089),
  (28, 35.706, 4.542),
  (29, 35.397, 0.140),
  (30, 31.949, 5.325),
  (31, 35.697, -0.633),
  (32, 33.683, 1.020),
  (33, 26.483, 8.467),
  (34, 36.073, 4.761),
  (35, 36.766, 3.477),
  (36, 36.767, 8.314),
  (37, 27.674, -8.147),
  (38, 35.607, 1.811),
  (39, 33.368, 6.867),
  (40, 35.436, 7.143),
  (41, 36.286, 7.951),
  (42, 36.589, 2.448),
  (43, 36.450, 6.264),
  (44, 36.264, 1.968),
  (45, 33.267, -0.317),
  (46, 35.297, -1.140),
  (47, 32.490, 3.674),
  (48, 35.737, 0.556),
  (49, 29.263, 0.231),
  (50, 21.328, 0.948),
  (51, 34.416, 5.070),
  (52, 30.131, -2.167),
  (53, 27.197, 2.483),
  (54, 19.567, 5.767),
  (55, 33.105, 6.064),
  (56, 24.554, 9.485),
  (57, 33.950, 5.917),
  (58, 30.583, 2.883)
on conflict (code) do update set lat = excluded.lat, lng = excluded.lng;

-- "31 - Oran" → 31
create or replace function public.wilaya_code(p text)
returns int language sql immutable as $$
  select nullif(substring(coalesce(p, '') from '^\s*(\d{1,2})'), '')::int
$$;

-- Road-agnostic distance (km, great circle) between two wilaya capitals; null when unknown.
create or replace function public.wilaya_km(a int, b int)
returns int language sql stable set search_path = public as $$
  select case when a = b then 0 else round(6371 * 2 * asin(sqrt(
      power(sin(radians(y.lat - x.lat) / 2), 2) +
      cos(radians(x.lat)) * cos(radians(y.lat)) * power(sin(radians(y.lng - x.lng) / 2), 2))))::int end
  from public.wilaya_coords x, public.wilaya_coords y where x.code = a and y.code = b
$$;
grant execute on function public.wilaya_code(text) to anon, authenticated;
grant execute on function public.wilaya_km(int, int) to anon, authenticated;

-- Shops nearest to a wilaya (only shops with visible products), with their distance.
create or replace function public.public_nearby_shops(p_wilaya int, p_category text default null, p_limit int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.shop order by x.km nulls last, x.delivered desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya, 'description', s.description,
      'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id), 'verified', s.verified,
      'cover', coalesce(nullif(s.cover_url, ''),
               (select p.images[1] from public.products p
                where p.shop_id = s.id and p.active and array_length(p.images, 1) > 0
                order by p.position, p.created_at limit 1), ''),
      'product_count', (select count(*) from public.products p where p.shop_id = s.id and p.active),
      'delivered_count', d.delivered,
      'distance_km', public.wilaya_km(p_wilaya, public.wilaya_code(s.wilaya))
    ) || public.shop_rating(s.id) shop,
    public.wilaya_km(p_wilaya, public.wilaya_code(s.wilaya)) km, d.delivered
    from public.shops s
    cross join lateral (select count(*) delivered from public.orders o where o.shop_id = s.id and o.status = 'delivered') d
    where s.status = 'approved' and not s.suspended
      and exists (select 1 from public.products p where p.shop_id = s.id and p.active
                  and (p_category is null or p_category = '' or p.category = p_category))
    order by km nulls last, d.delivered desc
    limit least(greatest(coalesce(p_limit, 12), 1), 50)
  ) x
$$;
grant execute on function public.public_nearby_shops(int, text, int) to anon, authenticated;

-- Explore: same as before, plus p_near (wilaya code) = nearest shops first.
drop function if exists public.public_products(text, text, int, int, text, text);
create or replace function public.public_products(
  p_category text default null, p_q text default null, p_limit int default 24, p_offset int default 0,
  p_tag text default null, p_sub text default null, p_near int default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.card order by x.rn), '[]'::jsonb) from (
    select public.product_card(p, s) card,
      row_number() over (order by public.wilaya_km(p_near, public.wilaya_code(s.wilaya)) nulls last, p.created_at desc) rn
    from public.products p join public.shops s on s.id = p.shop_id
    where p.active
      and (p_category is null or p_category = '' or p.category = p_category)
      and (p_sub is null or p_sub = '' or p.subcategory = p_sub)
      and (p_tag is null or p_tag = '' or p_tag = any (p.tags))
      and (p_q is null or p_q = '' or p.name ilike '%' || p_q || '%'
           or p.description ilike '%' || p_q || '%' or s.name ilike '%' || p_q || '%')
    order by rn
    limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
  ) x
$$;
grant execute on function public.public_products(text, text, int, int, text, text, int) to anon, authenticated;

-- Seller groups (explore with a subcategory): nearest first when p_near is given.
drop function if exists public.public_sellers(text, text, text, text, int);
create or replace function public.public_sellers(
  p_category text default null, p_sub text default null, p_tag text default null, p_q text default null,
  p_limit int default 20, p_near int default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with p as (
    select p.*, s.id sid from public.products p join public.shops s on s.id = p.shop_id
    where p.active
      and (p_category is null or p_category = '' or p.category = p_category)
      and (p_sub is null or p_sub = '' or p.subcategory = p_sub)
      and (p_tag is null or p_tag = '' or p_tag = any (p.tags))
      and (p_q is null or p_q = '' or p.name ilike '%' || p_q || '%' or p.description ilike '%' || p_q || '%')
  ),
  shops as (
    select s.*, count(p.id) n, public.wilaya_km(p_near, public.wilaya_code(s.wilaya)) km,
      (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered') delivered
    from public.shops s join p on p.sid = s.id group by s.id
  )
  select coalesce(jsonb_agg(x.j order by x.km nulls last, x.verified desc, x.delivered desc, x.n desc), '[]'::jsonb) from (
    select sh.km, sh.verified, sh.delivered, sh.n, jsonb_build_object(
      'id', sh.id, 'name', sh.name, 'slug', sh.slug, 'wilaya', sh.wilaya, 'verified', sh.verified,
      'logo', sh.logo, 'logo_url', sh.logo_url, 'category', public.shop_category(sh.id),
      'delivered_count', sh.delivered, 'product_count', sh.n, 'distance_km', sh.km,
      'products', (select jsonb_agg(c.card) from (
          select public.product_card(pp, sh2) card from public.products pp, public.shops sh2
          where sh2.id = sh.id and pp.id in (select id from p where p.sid = sh.id)
          order by pp.position, pp.created_at limit 10) c)
    ) || public.shop_rating(sh.id) j
    from shops sh
    order by sh.km nulls last, sh.verified desc, sh.delivered desc, sh.n desc
    limit least(greatest(p_limit, 1), 50)
  ) x
$$;
grant execute on function public.public_sellers(text, text, text, text, int, int) to anon, authenticated;
