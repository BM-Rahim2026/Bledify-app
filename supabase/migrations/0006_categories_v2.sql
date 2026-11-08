-- Categories v2 (6 categories), seasonal collections (tags), product story,
-- favourites, multi-shop cart lookup, demo data for the new categories.

-- ---------------------------------------------------------------- categories
alter table public.products drop constraint if exists products_category_check;
update public.products set category = case category
  when 'gateaux' then 'food' when 'cuisine' then 'food'
  when 'couture' then 'fashion' when 'enfants' then 'fashion' when 'bijoux' then 'fashion'
  when 'artisanat' then 'crafts' when 'beaute' then 'terroir'
  else category end;
alter table public.products alter column category set default 'crafts';
alter table public.products add constraint products_category_check
  check (category in ('food','fashion','crafts','home','terroir','occasions'));

-- seasonal collections and a short story per product
alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products drop constraint if exists products_tags_check;
alter table public.products add constraint products_tags_check
  check (tags <@ array['ramadan','aid','mariage','ete']::text[]);
create index if not exists products_tags_idx on public.products using gin (tags);
alter table public.products add column if not exists story text not null default '';

-- ---------------------------------------------------------------- favourites
create table if not exists public.favorites (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((product_id is null) <> (shop_id is null))
);
create unique index if not exists favorites_product_uidx on public.favorites (user_id, product_id) where product_id is not null;
create unique index if not exists favorites_shop_uidx on public.favorites (user_id, shop_id) where shop_id is not null;
alter table public.favorites enable row level security;
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.favorites to authenticated;
grant usage on sequence public.favorites_id_seq to authenticated;

-- ---------------------------------------------------------------- public reads
create or replace function public.product_card(p public.products, s public.shops)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'price_dzd', p.price_dzd,
    'image', coalesce(p.images[1], ''), 'category', p.category, 'tags', to_jsonb(p.tags),
    'shop_id', s.id, 'shop_name', s.name, 'shop_slug', s.slug, 'shop_wilaya', s.wilaya)
$$;

drop function if exists public.public_products(text, text, int, int);
create or replace function public.public_products(
  p_category text default null, p_q text default null, p_limit int default 24, p_offset int default 0,
  p_tag text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.card), '[]'::jsonb) from (
    select public.product_card(p, s) card
    from public.products p join public.shops s on s.id = p.shop_id
    where p.active
      and (p_category is null or p_category = '' or p.category = p_category)
      and (p_tag is null or p_tag = '' or p_tag = any (p.tags))
      and (p_q is null or p_q = '' or p.name ilike '%' || p_q || '%'
           or p.description ilike '%' || p_q || '%' or s.name ilike '%' || p_q || '%')
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
  ) x
$$;
grant execute on function public.public_products(text, text, int, int, text) to anon, authenticated;

create or replace function public.public_product(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'story', p.story, 'price_dzd', p.price_dzd,
    'images', to_jsonb(p.images), 'category', p.category, 'tags', to_jsonb(p.tags),
    'shop', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya,
      'description', s.description, 'delivery_home_dzd', s.delivery_home_dzd,
      'delivery_desk_dzd', s.delivery_desk_dzd,
      'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id),
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

-- Product cards for the cart (any shops), with each shop's delivery fees.
create or replace function public.public_cart(p_ids uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.product_card(p, s) || jsonb_build_object(
      'delivery_home_dzd', s.delivery_home_dzd, 'delivery_desk_dzd', s.delivery_desk_dzd,
      'shop_logo', s.logo, 'shop_logo_url', s.logo_url)), '[]'::jsonb)
  from public.products p join public.shops s on s.id = p.shop_id
  where p.id = any (p_ids[1:100]) and p.active
$$;
grant execute on function public.public_cart(uuid[]) to anon, authenticated;

-- The signed-in user's favourite products and shops.
create or replace function public.my_favorites()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(public.product_card(p, s) order by f.created_at desc)
      from public.favorites f join public.products p on p.id = f.product_id join public.shops s on s.id = p.shop_id
      where f.user_id = auth.uid() and p.active), '[]'::jsonb),
    'shops', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya,
        'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id)) order by f.created_at desc)
      from public.favorites f join public.shops s on s.id = f.shop_id
      where f.user_id = auth.uid()), '[]'::jsonb))
$$;
revoke all on function public.my_favorites() from anon;
grant execute on function public.my_favorites() to authenticated;

-- shop ids on the home page (for the ♥ button)
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

-- ---------------------------------------------------------------- demo data
update public.products p set category = 'food', tags = array['aid','mariage','ramadan']::text[], story = 'Yasmina étale sa pâte à la main, feuille par feuille, comme sa mère à Blida. Amandes grillées le matin même et miel pur : pas de sirop industriel.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Baklawa aux amandes (boîte de 30)';
update public.products p set category = 'food', tags = array['ramadan','aid']::text[], story = 'La pâte de dattes est préparée maison avec des Deglet Nour de Biskra. Chaque losange est façonné à la main puis trempé dans le miel.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Makrout au miel (1 kg)';
update public.products p set category = 'food', tags = array['ramadan']::text[], story = 'La recette algéroise de la grand-mère de Yasmina : semoule fine, amandes et un sirop parfumé à l''eau de fleur d''oranger distillée maison.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Kalb el louz (plateau de 24 parts)';
update public.products p set category = 'food', tags = array['aid','mariage']::text[], story = 'Cinq gâteaux traditionnels préparés la semaine de l''Aïd, présentés sur plateau, prêts à offrir ou à servir aux invités.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Plateau de l''Aïd (60 pièces assorties)';
update public.products p set category = 'food', tags = array[]::text[], story = 'Fatma roule son couscous à la main dans une gasaa en bois, puis le fait sécher au soleil de Kabylie. Sans conservateur.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Couscous roulé à la main (2 kg)';
update public.products p set category = 'food', tags = array['ramadan']::text[], story = 'Pliés et dorés chaque matin dans la cuisine de Mama Fatma à Tizi Ouzou, à servir avec du miel ou du beurre.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Msemen faits maison (lot de 10)';
update public.products p set category = 'terroir', tags = array[]::text[], story = 'Récolté dans les ruches de la famille Aït Ahmed, sur les montagnes de Béjaïa. Non chauffé, non filtré industriellement.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Miel de montagne (1 kg)';
update public.products p set category = 'terroir', tags = array[]::text[], story = 'Olives de l''oliveraie familiale, pressées à froid au moulin du village. Une huile verte et fruitée, de la récolte de l''année.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Huile d''olive vierge extra (1 L)';
update public.products p set category = 'terroir', tags = array['ramadan']::text[], story = 'Dattes de Biskra choisies une à une par la famille, encore en branchettes, idéales pour rompre le jeûne.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Dattes Deglet Nour (2 kg)';
update public.products p set category = 'fashion', tags = array['mariage']::text[], story = 'Nesrine brode la fetla au fil doré à la main dans son atelier à Alger. Chaque karakou est cousu sur mesure, en trois semaines.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Karakou algérois brodé main';
update public.products p set category = 'fashion', tags = array['mariage','aid']::text[], story = 'Un caftan cousu sur mesure par Nesrine, en velours émeraude avec une broderie dorée faite main.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Caftan en velours brodé';
update public.products p set category = 'fashion', tags = array['mariage','ete']::text[], story = 'Les galons colorés sont cousus un à un. Nesrine vous laisse choisir les couleurs pour une robe unique.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Robe kabyle traditionnelle';
update public.products p set category = 'fashion', tags = array[]::text[], story = 'Laine chaude, finitions à la main : la kachabia des hivers des Hauts-Plateaux, cousue à Alger.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Kachabia en laine (homme)';
update public.products p set category = 'fashion', tags = array[]::text[], story = 'Sarah, maman de trois enfants à Constantine, crochète chaque ensemble en coton doux pendant la sieste des petits.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Ensemble bébé au crochet';
update public.products p set category = 'fashion', tags = array['aid']::text[], story = 'Tulle et fleurs brodées à la main, cousue par Sarah pour que chaque petite fille ait sa robe de l''Aïd.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Robe de fête fillette';
update public.products p set category = 'home', tags = array[]::text[], story = 'Tissé sur un métier traditionnel par les femmes de la famille à Tlemcen. Les motifs se transmettent de mère en fille.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Tapis berbère tissé main (150 × 200)';
update public.products p set category = 'home', tags = array[]::text[], story = 'Laine naturelle tissée à la main à Tlemcen, rayures et franges nouées une à une.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Couverture tissée en laine';
update public.products p set category = 'home', tags = array['ramadan']::text[], story = 'Broderie traditionnelle faite à la main en terracotta et indigo, pour un salon chaleureux.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Coussins brodés (lot de 2)';
update public.products p set category = 'home', tags = array['ete']::text[], story = 'Tressé à la main à Tlemcen avec des anses en cuir, pour le linge, le marché ou la plage.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Panier en osier tressé';
update public.products p set category = 'crafts', tags = array['ramadan']::text[], story = 'Ciselé au marteau et au burin par un artisan du vieux Constantine. Comptez deux jours de travail par plateau.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Plateau en cuivre ciselé';
update public.products p set category = 'home', tags = array['ramadan']::text[], story = 'Ajourée à la main à Constantine : la lumière dessine des étoiles sur les murs, parfaite pour les soirées de Ramadan.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Lanterne en cuivre ciselé';
update public.products p set category = 'crafts', tags = array['ete']::text[], story = 'Terre cuite façonnée et peinte à la main en Kabylie, avec les motifs géométriques transmis par les anciennes.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Poterie kabyle peinte (lot de 3)';
update public.products p set category = 'fashion', tags = array['mariage']::text[], story = 'Argent émaillé et corail, travaillé à Beni Yenni selon la tradition. Un bijou que l''on transmet.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Bracelet kabyle en argent';
update public.products p set category = 'terroir', tags = array[]::text[], story = 'Amel fabrique ses savons à froid à Oran avec de l''huile d''olive, du miel et de l''argile. Cure de quatre semaines.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Savons artisanaux (lot de 4)';
update public.products p set category = 'terroir', tags = array['mariage']::text[], story = 'Le savon noir à l''huile d''olive préparé par Amel, avec un gant kessa : tout pour le hammam.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Coffret hammam : savon noir & kessa';
update public.products p set category = 'occasions', tags = array['mariage','aid']::text[], story = 'Henné pur, tamisé finement par Amel. Pour les cheveux, les mains et la soirée de henné.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Henné naturel (250 g)';
update public.products p set category = 'terroir', tags = array[]::text[], story = 'Un mélange d''huiles végétales préparé à Oran pour nourrir et fortifier les cheveux.'
  from public.shops s where s.id = p.shop_id and s.is_demo and p.name = 'Huile capillaire naturelle (50 ml)';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'd6897612-ee9a-49d9-ab07-1f845a97b055', 'authenticated', 'authenticated', 'creations-de-lina@demo.bledify.app', '', now(),
  '{"provider":"email","providers":["email"]}', '{"demo":true,"role":"seller","language":"fr"}', now() - interval '60 days', now(), '', '', '', '')
on conflict (id) do nothing;
insert into public.shops (id, owner_id, name, slug, description, phone, whatsapp, wilaya, delivery_home_dzd, delivery_desk_dzd,
  notify_new_orders, is_demo, cover_url, logo)
values ('6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'd6897612-ee9a-49d9-ab07-1f845a97b055', 'Les Créations de Lina', 'creations-de-lina', 'Plateaux de henné, corbeilles de mariée et boîtes de dragées faits main pour les mariages et les fêtes.',
  '0661000909', '0661000909', '35 - Boumerdès', 600, 400, false, true, 'https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/02179406042452634cac430b5ac258905380d809540adb4c12c16_0_1794060430735_f7b59461.jpeg', '{"shape":"arch","color":"sand","content":"icon"}')
on conflict (slug) do nothing;
insert into public.products (id, owner_id, shop_id, name, description, story, price_dzd, images, category, tags, position, created_at)
values ('d15ee4e6-6fc2-45af-adc1-31f09a029d22', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Plateau de henné complet (hennaya)', 'Plateau en satin brodé, bol de henné, bougies et rubans dorés, préparé pour la soirée de henné.', 'Lina décore chaque plateau à la main à Boumerdès, aux couleurs choisies par la mariée. Livré prêt pour la soirée de henné.', 12500, array['https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/02179406042452634cac430b5ac258905380d809540adb4c12c16_0_1794060430735_f7b59461.jpeg'], 'occasions', array['mariage'], 0, now() - interval '0 hours')
on conflict (id) do nothing;
insert into public.products (id, owner_id, shop_id, name, description, story, price_dzd, images, category, tags, position, created_at)
values ('bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Boîtes de dragées pour mariage (lot de 50)', 'Petites boîtes ivoire, ruban doré et fleurs séchées, garnies de dragées.', 'Les tawzi3at de Lina : chaque boîte est pliée, garnie et nouée à la main. Prénoms des mariés possibles sur demande.', 7500, array['https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/021794060426025008f00307548aaad250a55687bd5a742510f51_0_1794060433045_ff24c89a.jpeg'], 'occasions', array['mariage'], 1, now() - interval '7 hours')
on conflict (id) do nothing;
insert into public.products (id, owner_id, shop_id, name, description, story, price_dzd, images, category, tags, position, created_at)
values ('d3e16757-4ed1-4a74-a733-c8f39b4305a1', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Corbeille de la mariée garnie', 'Corbeille tressée doublée de satin, présentée avec karakou, foulard et écrin à bijoux.', 'Lina compose la corbeille du trousseau avec vos pièces ou celles de nos couturières, décorée de roses et de satin.', 18000, array['https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/0217940604268800958c43c09b2d8895d306984ebab65852238f8_0_1794060433346_7cdbed34.jpeg'], 'occasions', array['mariage'], 2, now() - interval '14 hours')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('891b8491-389a-43c1-a0ba-5f1f32451a96', 'BL-190000', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Amira B.', '0551200000', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '12 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('ae546962-9355-4b57-ac61-9f5dc6744867', 'BL-190001', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Kenza T.', '0551200037', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '14 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('b8515f5d-95bc-4d2a-a1cf-61b5fe2b6059', 'BL-190002', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Nour H.', '0551200074', '16 - Alger',
  '[{"product_id": "d3e16757-4ed1-4a74-a733-c8f39b4305a1", "name": "Corbeille de la mari\u00e9e garnie", "unit_price_dzd": 18000, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '16 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('ce4877ec-f676-460c-a841-759821009440', 'BL-190003', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Selma D.', '0551200111', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '18 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('b0ed3929-ee77-4f09-abb1-551601a008b9', 'BL-190004', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Amira B.', '0551200148', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '20 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('88f7cf51-832b-4134-a64e-b9db15a46d64', 'BL-190005', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Kenza T.', '0551200185', '16 - Alger',
  '[{"product_id": "d3e16757-4ed1-4a74-a733-c8f39b4305a1", "name": "Corbeille de la mari\u00e9e garnie", "unit_price_dzd": 18000, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '22 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('6d9fb125-bf8f-49c8-a1ef-62103b66edbb', 'BL-190006', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Nour H.', '0551200222', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '24 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('a41822ae-002a-49f7-ab2c-c6e3485c439e', 'BL-190007', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Selma D.', '0551200259', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '26 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('b95c7adc-9c04-4c9d-a3e4-fe2a26844f08', 'BL-190008', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Amira B.', '0551200296', '16 - Alger',
  '[{"product_id": "d3e16757-4ed1-4a74-a733-c8f39b4305a1", "name": "Corbeille de la mari\u00e9e garnie", "unit_price_dzd": 18000, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '28 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('2f31f898-6402-4560-ad13-adc067e0b554', 'BL-190009', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Kenza T.', '0551200333', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '30 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('e195e7fe-5d4a-4a01-a5ec-5ecdc69e9001', 'BL-190010', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Nour H.', '0551200370', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '32 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('3cd43b8e-d3a3-412f-aa15-da6e5593b362', 'BL-190011', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Selma D.', '0551200407', '16 - Alger',
  '[{"product_id": "d3e16757-4ed1-4a74-a733-c8f39b4305a1", "name": "Corbeille de la mari\u00e9e garnie", "unit_price_dzd": 18000, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '34 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('bf155e6b-d522-4cd4-ad95-acdb574ad324', 'BL-190012', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Amira B.', '0551200444', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '36 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('f605b38f-be84-4e74-a236-3832cc6af4d9', 'BL-190013', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Kenza T.', '0551200481', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '38 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('c514cb9e-feaf-484d-a557-31251c3836d5', 'BL-190014', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Nour H.', '0551200518', '16 - Alger',
  '[{"product_id": "d3e16757-4ed1-4a74-a733-c8f39b4305a1", "name": "Corbeille de la mari\u00e9e garnie", "unit_price_dzd": 18000, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '40 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('a3878faa-0610-428f-a1f7-7dd6ce17ed57', 'BL-190015', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Selma D.', '0551200555', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '42 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('60ebc680-239e-445f-ac23-ea608b37208c', 'BL-190016', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Amira B.', '0551200592', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '44 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('b1ac96df-e449-4d43-a1d9-f9d8e2187bfb', 'BL-190017', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Kenza T.', '0551200629', '16 - Alger',
  '[{"product_id": "d3e16757-4ed1-4a74-a733-c8f39b4305a1", "name": "Corbeille de la mari\u00e9e garnie", "unit_price_dzd": 18000, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '46 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('59dafd43-3ffc-40a7-a365-336ff3fdd25f', 'BL-190018', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Nour H.', '0551200666', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '48 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('c87af4c2-f0a8-4d33-a1a3-fc08ab1e838f', 'BL-190019', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Selma D.', '0551200703', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '50 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('39f136cd-2600-4f2c-af5c-9ab622abe84f', 'BL-190020', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Amira B.', '0551200740', '16 - Alger',
  '[{"product_id": "d3e16757-4ed1-4a74-a733-c8f39b4305a1", "name": "Corbeille de la mari\u00e9e garnie", "unit_price_dzd": 18000, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '52 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('77e96a20-d851-40ee-a75d-177bad062313', 'BL-190021', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Kenza T.', '0551200777', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '54 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('9f35ed48-e873-488c-abd5-fd0f382e015d', 'BL-190022', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Nour H.', '0551200814', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '56 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('17a118ff-9fca-4132-a9f0-eea190d2c34a', 'BL-190023', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Selma D.', '0551200851', '16 - Alger',
  '[{"product_id": "d3e16757-4ed1-4a74-a733-c8f39b4305a1", "name": "Corbeille de la mari\u00e9e garnie", "unit_price_dzd": 18000, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '58 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('1b253386-c485-4af4-a31a-2b4715ecbaef', 'BL-190024', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Amira B.', '0551200888', '16 - Alger',
  '[{"product_id": "d15ee4e6-6fc2-45af-adc1-31f09a029d22", "name": "Plateau de henn\u00e9 complet (hennaya)", "unit_price_dzd": 12500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '60 days')
on conflict (id) do nothing;
insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values ('b53f6386-b964-4f29-a36c-219be8047f90', 'BL-190025', 'd6897612-ee9a-49d9-ab07-1f845a97b055', '6f5c3166-0c4b-4997-aa1d-054e622a89ab', 'Kenza T.', '0551200925', '16 - Alger',
  '[{"product_id": "bb1d4016-d2c1-42c7-a6ed-ffbf62a2de61", "name": "Bo\u00eetes de drag\u00e9es pour mariage (lot de 50)", "unit_price_dzd": 7500, "quantity": 1}]'::jsonb, 400, 'delivered', 'shop', now() - interval '62 days')
on conflict (id) do nothing;
