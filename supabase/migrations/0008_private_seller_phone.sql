-- Seller phone numbers are private: used by the Bledify team only (identity checks, KYC).
-- Buyers never see them; the shop contacts the buyer, not the other way round.

-- 1. The public shop no longer returns the seller's WhatsApp number.
create or replace function public.get_public_shop(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
    'wilaya', s.wilaya, 'verified', s.verified,
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

-- 2. No phone numbers in public texts (shop name/description, product name/description/story).
create or replace function public.has_phone(t text)
returns boolean language sql immutable as $$
  select coalesce(t, '') ~ '(\+|00)\s*213([\s.\-/]*[0-9]){9}'
      or coalesce(t, '') ~ '(^|[^0-9])0[\s.\-/]*[5-7]([\s.\-/]*[0-9]){8}([^0-9]|$)'
$$;

create or replace function public.block_phone_in_text()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'shops' then
    if public.has_phone(new.name) or public.has_phone(new.description) then
      raise exception 'PHONE_IN_TEXT' using errcode = '22023';
    end if;
  elsif public.has_phone(new.name) or public.has_phone(new.description) or public.has_phone(new.story) then
    raise exception 'PHONE_IN_TEXT' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists shops_block_phone on public.shops;
create trigger shops_block_phone before insert or update of name, description on public.shops
  for each row execute function public.block_phone_in_text();
drop trigger if exists products_block_phone on public.products;
create trigger products_block_phone before insert or update of name, description, story on public.products
  for each row execute function public.block_phone_in_text();
