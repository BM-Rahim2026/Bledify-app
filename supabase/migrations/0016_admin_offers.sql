-- Bledify team (admins) and the admin functions for offers. Admins are added by SQL only:
--   insert into public.admins (user_id) select id from auth.users where email = '…';
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.admins where user_id = auth.uid())
$$;
grant execute on function public.is_admin() to authenticated;

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN' using errcode = '42501'; end if;
end $$;
revoke all on function public.require_admin() from public, anon;

-- Proposals with product, shop and offer details. p_status: pending | approved | rejected | null (all).
create or replace function public.admin_offer_entries(p_status text default 'pending', p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc) from (
      select e.created_at, jsonb_build_object(
        'id', e.id, 'status', e.status, 'note', e.note, 'created_at', e.created_at, 'reviewed_at', e.reviewed_at,
        'offer', jsonb_build_object('slug', o.slug, 'title_fr', o.title_fr, 'title_ar', o.title_ar, 'kind', o.kind, 'active', o.active),
        'product', jsonb_build_object('id', p.id, 'name', p.name, 'price_dzd', p.price_dzd, 'image', coalesce(p.images[1], ''),
          'category', p.category, 'subcategory', p.subcategory, 'active', p.active),
        'shop', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya, 'verified', s.verified)) j
      from public.offer_entries e
      join public.offers o on o.slug = e.offer_slug
      join public.products p on p.id = e.product_id
      join public.shops s on s.id = e.shop_id
      where p_status is null or p_status = '' or e.status = p_status
      order by e.created_at desc
      limit least(greatest(p_limit, 1), 300)) x), '[]'::jsonb);
end $$;

create or replace function public.admin_review_offer_entry(p_entry bigint, p_approve boolean, p_note text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.offer_entries set status = case when p_approve then 'approved' else 'rejected' end,
    note = left(coalesce(p_note, ''), 300) where id = p_entry;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
end $$;

-- All offers (active or not) with their counts.
create or replace function public.admin_offers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(to_jsonb(o) || jsonb_build_object(
      'pending', (select count(*) from public.offer_entries e where e.offer_slug = o.slug and e.status = 'pending'),
      'approved', (select count(*) from public.offer_entries e where e.offer_slug = o.slug and e.status = 'approved'))
    order by o.position, o.created_at) from public.offers o), '[]'::jsonb);
end $$;

-- Create or edit an offer (slug cannot change once created).
create or replace function public.admin_save_offer(p_offer jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  insert into public.offers (slug, kind, title_fr, title_ar, image, icon, position, active)
  values (lower(trim(p_offer->>'slug')), coalesce(p_offer->>'kind', 'seasonal'), trim(p_offer->>'title_fr'), trim(p_offer->>'title_ar'),
    coalesce(p_offer->>'image', ''), coalesce(nullif(p_offer->>'icon', ''), 'gift'),
    coalesce((p_offer->>'position')::int, 0), coalesce((p_offer->>'active')::boolean, true))
  on conflict (slug) do update set kind = excluded.kind, title_fr = excluded.title_fr, title_ar = excluded.title_ar,
    image = excluded.image, icon = excluded.icon, position = excluded.position, active = excluded.active;
end $$;

revoke all on function public.admin_offer_entries(text, int) from public, anon;
revoke all on function public.admin_review_offer_entry(bigint, boolean, text) from public, anon;
revoke all on function public.admin_offers() from public, anon;
revoke all on function public.admin_save_offer(jsonb) from public, anon;
grant execute on function public.admin_offer_entries(text, int) to authenticated;
grant execute on function public.admin_review_offer_entry(bigint, boolean, text) to authenticated;
grant execute on function public.admin_offers() to authenticated;
grant execute on function public.admin_save_offer(jsonb) to authenticated;
alter table public.offers add constraint offers_titles_check check (length(title_fr) between 2 and 60 and length(title_ar) between 2 and 60) not valid;
