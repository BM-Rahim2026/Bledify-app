-- No rentals for now: "Location de tenues & bijoux" is removed from Mariée & occasions.
update public.products set subcategory = null where category = 'occasions' and subcategory = 'rental';

create or replace function public.subcategories_of(p_category text)
returns text[] language sql immutable as $$
  select case p_category
    when 'food' then array['trad_cakes','modern_cakes','savory','breads','couscous_pasta','dishes','jams_sweets','chocolate','trays_boxes','catering']
    when 'fashion' then array['women_traditional','modern_modest','hijabs','men','kids_babies','knitting','bags_accessories','shoes','tailoring']
    when 'crafts' then array['pottery','copper','jewelry','embroidery','weaving','basketry','leather','wood','calligraphy','instruments']
    when 'home' then array['rugs','linens','cushions','tableware','utensils','lighting','wall_decor','candles_incense','baskets_storage','furniture']
    when 'terroir' then array['olive_oil','honey','dates','produce','eggs','dairy','grains','spices_herbs','dried_fruits_nuts','processed','plants_seeds']
    when 'occasions' then array['trousseau','henna','decorated_trays','favors','invitations','event_decor','birth_circumcision','custom_gifts']
    when 'beauty' then array['soaps','oils','face','hair','hammam_body','perfumes','khol_swak','baby_mom','men_beard','gift_sets']
    else array[]::text[] end
$$;
