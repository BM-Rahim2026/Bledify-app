-- Shops that sell in a category / subcategory, each with its matching products (explore "by shop").
create or replace function public.public_sellers(
  p_category text default null, p_sub text default null, p_tag text default null, p_q text default null,
  p_limit int default 20)
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
    select s.*, count(p.id) n,
      (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered') delivered
    from public.shops s join p on p.sid = s.id group by s.id
  )
  select coalesce(jsonb_agg(x.j order by x.verified desc, x.delivered desc, x.n desc), '[]'::jsonb) from (
    select sh.verified, sh.delivered, sh.n, jsonb_build_object(
      'id', sh.id, 'name', sh.name, 'slug', sh.slug, 'wilaya', sh.wilaya, 'verified', sh.verified,
      'logo', sh.logo, 'logo_url', sh.logo_url, 'category', public.shop_category(sh.id),
      'delivered_count', sh.delivered, 'product_count', sh.n,
      'products', (select jsonb_agg(c.card) from (
          select public.product_card(pp, sh2) card from public.products pp, public.shops sh2
          where sh2.id = sh.id and pp.id in (select id from p where p.sid = sh.id)
          order by pp.position, pp.created_at limit 10) c)
    ) || public.shop_rating(sh.id) j
    from shops sh
    order by sh.verified desc, sh.delivered desc, sh.n desc
    limit least(greatest(p_limit, 1), 50)
  ) x
$$;
grant execute on function public.public_sellers(text, text, text, text, int) to anon, authenticated;
