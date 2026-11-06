-- Shop logos: an uploaded image (logo_url) or a generated badge (logo = {shape, color, content}).

alter table public.shops add column if not exists logo_url text not null default '';
alter table public.shops add column if not exists logo jsonb not null default '{}'::jsonb;

-- Most common category among a shop's active products (drives the default logo icon).
create or replace function public.shop_category(p_shop uuid)
returns text language sql stable as $$
  select category from public.products where shop_id = p_shop and active
  group by category order by count(*) desc, min(created_at) limit 1
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
          'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya, 'description', s.description,
          'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id),
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

create or replace function public.public_product(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'price_dzd', p.price_dzd,
    'images', to_jsonb(p.images), 'category', p.category,
    'shop', jsonb_build_object('name', s.name, 'slug', s.slug, 'wilaya', s.wilaya,
      'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id),
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
    'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id),
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

-- Logos for the demo shops
update public.shops s set logo = v.logo::jsonb
from (values
  ('delices-de-yasmina',          '{"shape":"arch","color":"terracotta","content":"icon"}'),
  ('cuisine-de-mama-fatma',       '{"shape":"circle","color":"saffron","content":"icon"}'),
  ('ferme-ait-ahmed',             '{"shape":"seal","color":"olive","content":"icon"}'),
  ('atelier-nesrine-couture',     '{"shape":"arch","color":"plum","content":"initials"}'),
  ('petits-points-de-sarah',      '{"shape":"circle","color":"rose","content":"icon"}'),
  ('dar-tlemcen-artisanat',       '{"shape":"diamond","color":"indigo","content":"initials"}'),
  ('artisans-de-constantine',     '{"shape":"seal","color":"green","content":"initials"}'),
  ('beaute-naturelle-amel',       '{"shape":"circle","color":"green","content":"icon"}')
) as v(slug, logo)
where s.slug = v.slug and s.is_demo;
