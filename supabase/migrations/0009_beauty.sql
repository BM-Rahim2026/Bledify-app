-- 7th category: natural / homemade cosmetics (soaps, oils, rose water, henna, clay, hair and skin care).
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('food','fashion','crafts','home','terroir','occasions','beauty'));

-- Demo: Amel's soaps, oils and henna move to the new category.
update public.products p set category = 'beauty'
  from public.shops s
  where s.id = p.shop_id and s.slug = 'beaute-naturelle-amel' and s.is_demo;

-- Demo: four more homemade cosmetics.
insert into public.products (id, owner_id, shop_id, name, description, story, price_dzd, images, category, tags, position, created_at)
select v.id::uuid, s.owner_id, s.id, v.name, v.description, v.story, v.price, array[v.image], 'beauty', v.tags::text[], v.pos, now() - (v.pos || ' days')::interval
from public.shops s,
(values
  ('5b0c5d0e-7a51-4c1e-9a3e-1f0b7e2c9a01', 'Eau de rose distillée maison (2 × 250 ml)',
   'Eau de rose pure, distillée à l''alambic en cuivre (tqtir). Tonique pour le visage, pâtisserie et parfum de la maison.',
   'Chaque printemps, Amel distille les roses du jardin familial dans le qettar en cuivre, comme on le fait à Constantine : une seule distillation lente, sans alcool ni parfum ajouté.',
   1200, 'https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/02179413284222111300f35b2a874e35aceb4d35afb57b88959d9_0_1794132849561_f731f5f1.jpeg',
   '{ramadan,aid,mariage}', 4),
  ('5b0c5d0e-7a51-4c1e-9a3e-1f0b7e2c9a02', 'Savon liquide mains à l''huile d''olive (500 ml)',
   'Savon liquide doux pour les mains, saponifié à froid à l''huile d''olive de Kabylie. Sans parfum de synthèse. Flacon pompe en verre.',
   'Fait en petites séries avec l''huile d''olive de la famille. Doux pour les mains qui lavent souvent, même celles des enfants.',
   950, 'https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/02179413284494099f4740eadd3360aa6250e68d85f7ec77e98cf_0_1794132851735_7fd337bd.jpeg',
   '{}', 5),
  ('5b0c5d0e-7a51-4c1e-9a3e-1f0b7e2c9a03', 'Huile de pépins de figue de barbarie (30 ml)',
   'Huile pure pressée à froid, pour le visage et le contour des yeux. Quelques gouttes le soir suffisent.',
   'Les figues de barbarie sont cueillies l''été, les pépins séchés au soleil puis pressés à froid. Il faut près de 30 kg de fruits pour ce petit flacon.',
   2800, 'https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/0217941328447441f48ceb9aa55112abbdf6fec19339eb3f50633_0_1794132851375_534049c5.jpeg',
   '{ete}', 6),
  ('5b0c5d0e-7a51-4c1e-9a3e-1f0b7e2c9a04', 'Masque visage argile & ghassoul (200 g)',
   'Mélange d''argile, de ghassoul et de pétales de rose séchés. À mélanger avec de l''eau de rose pour un masque doux.',
   'Une recette de hammam transmise dans la famille : l''argile est tamisée à la main et mélangée aux pétales de rose et à la fleur d''oranger séchés.',
   900, 'https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/021794132845691c95e3350f28d4e5f7ad155450ef541a3a4d584_0_1794132851971_74194c1d.jpeg',
   '{mariage}', 7)
) as v(id, name, description, story, price, image, tags, pos)
where s.slug = 'beaute-naturelle-amel' and s.is_demo
on conflict (id) do nothing;
