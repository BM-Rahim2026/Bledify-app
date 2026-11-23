-- Bledify is not a food-delivery service: no ready meals, savoury snacks or catering.
-- Their listings are deleted (offer entries, favourites and reviews follow by cascade) and the
-- subcategories leave the list; cakes, sweets, breads, chocolate and hand-rolled couscous stay.
delete from public.products where subcategory in ('dishes', 'catering', 'savory');

create or replace function public.subcategories_of(p_category text)
returns text[] language sql immutable as $$
  select case p_category
    when 'food' then array['trad_cakes','modern_cakes','breads','couscous_pasta','jams_sweets','chocolate','trays_boxes']
    when 'fashion' then array['women_traditional','modern_modest','hijabs','men','kids_babies','knitting','shoes','tailoring']
    when 'crafts' then array['pottery','copper','embroidery','weaving','basketry','leather','wood','calligraphy','instruments']
    when 'home' then array['rugs','linens','cushions','tableware','utensils','lighting','wall_decor','candles_incense','baskets_storage','furniture']
    when 'terroir' then array['olive_oil','honey','dates','produce','eggs','dairy','grains','spices_herbs','dried_fruits_nuts','processed','plants_seeds']
    when 'occasions' then array['trousseau','henna','decorated_trays','favors','invitations','event_decor','birth_circumcision','custom_gifts']
    when 'beauty' then array['soaps','oils','face','hair','hammam_body','perfumes','khol_swak','baby_mom','men_beard','gift_sets']
    when 'jewelry' then array['silver_traditional','fantasy','beads_stones','personalized','bags','hair_accessories','belts','small_accessories','jewelry_boxes']
    else array[]::text[] end
$$;
