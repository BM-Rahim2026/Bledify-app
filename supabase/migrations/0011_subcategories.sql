-- Subcategories inside each of the 7 categories (same list as src/lib/categories.ts; a test checks it).
create or replace function public.subcategories_of(p_category text)
returns text[] language sql immutable as $$
  select case p_category
    when 'food' then array['trad_cakes','modern_cakes','savory','breads','couscous_pasta','dishes','jams_sweets','chocolate','trays_boxes','catering']
    when 'fashion' then array['women_traditional','modern_modest','hijabs','men','kids_babies','knitting','bags_accessories','shoes','tailoring']
    when 'crafts' then array['pottery','copper','jewelry','embroidery','weaving','basketry','leather','wood','calligraphy','instruments']
    when 'home' then array['rugs','linens','cushions','tableware','utensils','lighting','wall_decor','candles_incense','baskets_storage','furniture']
    when 'terroir' then array['olive_oil','honey','dates','produce','eggs','dairy','grains','spices_herbs','dried_fruits_nuts','processed','plants_seeds']
    when 'occasions' then array['trousseau','henna','decorated_trays','favors','invitations','event_decor','birth_circumcision','custom_gifts','rental']
    when 'beauty' then array['soaps','oils','face','hair','hammam_body','perfumes','khol_swak','baby_mom','men_beard','gift_sets']
    else array[]::text[] end
$$;

alter table public.products add column if not exists subcategory text;
alter table public.products drop constraint if exists products_subcategory_check;
alter table public.products add constraint products_subcategory_check
  check (subcategory is null or subcategory = any (public.subcategories_of(category)));
create index if not exists products_subcategory_idx on public.products (category, subcategory) where active;

create or replace function public.product_card(p public.products, s public.shops)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'price_dzd', p.price_dzd,
    'image', coalesce(p.images[1], ''), 'category', p.category, 'subcategory', p.subcategory, 'tags', to_jsonb(p.tags),
    'shop_id', s.id, 'shop_name', s.name, 'shop_slug', s.slug, 'shop_wilaya', s.wilaya,
    'shop_verified', s.verified) || (
    select jsonb_build_object('rating', round(avg(r.rating), 1), 'review_count', count(*))
    from public.reviews r where r.product_id = p.id and not r.hidden)
$$;

drop function if exists public.public_products(text, text, int, int, text);
create or replace function public.public_products(
  p_category text default null, p_q text default null, p_limit int default 24, p_offset int default 0,
  p_tag text default null, p_sub text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.card), '[]'::jsonb) from (
    select public.product_card(p, s) card
    from public.products p join public.shops s on s.id = p.shop_id
    where p.active
      and (p_category is null or p_category = '' or p.category = p_category)
      and (p_sub is null or p_sub = '' or p.subcategory = p_sub)
      and (p_tag is null or p_tag = '' or p_tag = any (p.tags))
      and (p_q is null or p_q = '' or p.name ilike '%' || p_q || '%'
           or p.description ilike '%' || p_q || '%' or s.name ilike '%' || p_q || '%')
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
  ) x
$$;
grant execute on function public.public_products(text, text, int, int, text, text) to anon, authenticated;

create or replace function public.public_product(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'story', p.story, 'price_dzd', p.price_dzd,
    'images', to_jsonb(p.images), 'category', p.category, 'subcategory', p.subcategory, 'tags', to_jsonb(p.tags),
    'pay_cod', p.pay_cod, 'pay_card', p.pay_card, 'deposit_pct', p.deposit_pct,
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

-- How many active products per subcategory (to show only filled ones first).
create or replace function public.subcategory_counts(p_category text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(subcategory, n), '{}'::jsonb) from (
    select subcategory, count(*) n from public.products
    where active and category = p_category and subcategory is not null group by subcategory) x
$$;
grant execute on function public.subcategory_counts(text) to anon, authenticated;

-- ---------------------------------------------------------------- demo
update public.products p set category = 'crafts'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Bracelet kabyle en argent';
update public.products p set subcategory = v.sub
from public.shops s, (values
  ('Coffret hammam : savon noir & kessa', 'hammam_body'), ('Eau de rose distillée maison (2 × 250 ml)', 'face'),
  ('Henné naturel (250 g)', 'hair'), ('Huile capillaire naturelle (50 ml)', 'hair'),
  ('Huile de pépins de figue de barbarie (30 ml)', 'oils'), ('Masque visage argile & ghassoul (200 g)', 'face'),
  ('Savon liquide mains à l''huile d''olive (500 ml)', 'soaps'), ('Savons artisanaux (lot de 4)', 'soaps'),
  ('Plateau en cuivre ciselé', 'copper'), ('Poterie kabyle peinte (lot de 3)', 'pottery'), ('Bracelet kabyle en argent', 'jewelry'),
  ('Caftan en velours brodé', 'women_traditional'), ('Ensemble bébé au crochet', 'kids_babies'), ('Kachabia en laine (homme)', 'men'),
  ('Karakou algérois brodé main', 'women_traditional'), ('Robe de fête fillette', 'kids_babies'), ('Robe kabyle traditionnelle', 'women_traditional'),
  ('Baklawa aux amandes (boîte de 30)', 'trad_cakes'), ('Couscous roulé à la main (2 kg)', 'couscous_pasta'),
  ('Kalb el louz (plateau de 24 parts)', 'trad_cakes'), ('Makrout au miel (1 kg)', 'trad_cakes'),
  ('Msemen faits maison (lot de 10)', 'breads'), ('Plateau de l''Aïd (60 pièces assorties)', 'trays_boxes'),
  ('Coussins brodés (lot de 2)', 'cushions'), ('Couverture tissée en laine', 'linens'), ('Lanterne en cuivre ciselé', 'lighting'),
  ('Panier en osier tressé', 'baskets_storage'), ('Tapis berbère tissé main (150 × 200)', 'rugs'),
  ('Boîtes de dragées pour mariage (lot de 50)', 'favors'), ('Corbeille de la mariée garnie', 'trousseau'),
  ('Plateau de henné complet (hennaya)', 'henna'),
  ('Dattes Deglet Nour (2 kg)', 'dates'), ('Huile d''olive vierge extra (1 L)', 'olive_oil'), ('Miel de montagne (1 kg)', 'honey')
) as v(name, sub)
where s.id = p.shop_id and s.is_demo and p.name = v.name and v.sub = any (public.subcategories_of(p.category));
