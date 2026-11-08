-- 8th category "Bijoux & accessoires": jewellery leaves crafts, bags leave fashion.
alter table public.products drop constraint if exists products_category_check;
alter table public.products drop constraint if exists products_subcategory_check;

update public.products set category = 'jewelry',
  subcategory = case when subcategory = 'jewelry' and name ilike '%argent%' then 'silver_traditional' else null end
  where category = 'crafts' and subcategory = 'jewelry';
update public.products set category = 'jewelry', subcategory = 'bags'
  where category = 'fashion' and subcategory = 'bags_accessories';

create or replace function public.subcategories_of(p_category text)
returns text[] language sql immutable as $$
  select case p_category
    when 'food' then array['trad_cakes','modern_cakes','savory','breads','couscous_pasta','dishes','jams_sweets','chocolate','trays_boxes','catering']
    when 'fashion' then array['women_traditional','modern_modest','hijabs','men','kids_babies','knitting','shoes','tailoring']
    when 'crafts' then array['pottery','copper','embroidery','weaving','basketry','leather','wood','calligraphy','instruments']
    when 'home' then array['rugs','linens','cushions','tableware','utensils','lighting','wall_decor','candles_incense','baskets_storage','furniture']
    when 'terroir' then array['olive_oil','honey','dates','produce','eggs','dairy','grains','spices_herbs','dried_fruits_nuts','processed','plants_seeds']
    when 'occasions' then array['trousseau','henna','decorated_trays','favors','invitations','event_decor','birth_circumcision','custom_gifts']
    when 'beauty' then array['soaps','oils','face','hair','hammam_body','perfumes','khol_swak','baby_mom','men_beard','gift_sets']
    when 'jewelry' then array['silver_traditional','fantasy','beads_stones','personalized','bags','hair_accessories','belts','small_accessories','jewelry_boxes']
    else array[]::text[] end
$$;

-- anything left that no longer fits its category loses its subcategory
update public.products set subcategory = null
  where subcategory is not null and not (subcategory = any (public.subcategories_of(category)));

alter table public.products add constraint products_category_check
  check (category in ('food','fashion','crafts','home','terroir','occasions','beauty','jewelry'));
alter table public.products add constraint products_subcategory_check
  check (subcategory is null or subcategory = any (public.subcategories_of(category)));
