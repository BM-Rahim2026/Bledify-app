-- Offers managed by the Bledify team (seasonal now, special ones later). Shops propose products;
-- a product appears on an offer page only once the team approves it (marketing space).
-- products.tags is kept as the list of the product's approved, active offers (written by the database).

create table if not exists public.offers (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}$'),
  kind text not null default 'seasonal' check (kind in ('seasonal', 'special')),
  title_fr text not null,
  title_ar text not null,
  image text not null default '',
  icon text not null default 'gift',
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.offers enable row level security;
drop policy if exists offers_read on public.offers;
create policy offers_read on public.offers for select to anon, authenticated using (true);
revoke all on public.offers from anon, authenticated;
grant select on public.offers to anon, authenticated;

insert into public.offers (slug, kind, title_fr, title_ar, image, icon, position) values
  ('mariage', 'seasonal', 'Offres mariée', 'عروض العروس',
   'https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/02179406042452634cac430b5ac258905380d809540adb4c12c16_0_1794060430735_f7b59461.jpeg', 'occasions', 1),
  ('ramadan', 'seasonal', 'Offres Ramadan', 'عروض رمضان', '/home/season-ramadan.webp', 'moon', 2),
  ('aid', 'seasonal', 'Offres de l''Aïd', 'عروض العيد', '/home/season-aid.webp', 'gift', 3),
  ('ete', 'seasonal', 'Saison d''été', 'موسم الصيف', '/home/season-ete.webp', 'sun', 4)
on conflict (slug) do nothing;

create table if not exists public.offer_entries (
  id bigserial primary key,
  offer_slug text not null references public.offers (slug) on delete cascade on update cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text not null default '' check (length(note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (offer_slug, product_id)
);
create index if not exists offer_entries_status_idx on public.offer_entries (status, created_at);
alter table public.offer_entries enable row level security;
revoke all on public.offer_entries from anon, authenticated;
grant select, insert, delete on public.offer_entries to authenticated;
grant usage on sequence public.offer_entries_id_seq to authenticated;
drop policy if exists offer_entries_own on public.offer_entries;
create policy offer_entries_own on public.offer_entries for all to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.products p join public.shops s on s.id = p.shop_id
                      where p.id = product_id and s.id = shop_id and s.owner_id = auth.uid()));

-- Shops can only propose (pending); the decision belongs to the team.
create or replace function public.offer_entries_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.note := ''; new.reviewed_at := null;
      if not exists (select 1 from public.offers o where o.slug = new.offer_slug and o.active) then
        raise exception 'OFFER_CLOSED' using errcode = '22023';
      end if;
    else
      raise exception 'NOT_ALLOWED' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.reviewed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists offer_entries_guard on public.offer_entries;
create trigger offer_entries_guard before insert or update on public.offer_entries
  for each row execute function public.offer_entries_guard();

-- products.tags = approved entries of active offers
create or replace function public.refresh_product_offers(p_product uuid)
returns void language sql volatile security definer set search_path = public as $$
  update public.products p set tags = coalesce((
    select array_agg(e.offer_slug order by o.position) from public.offer_entries e
    join public.offers o on o.slug = e.offer_slug
    where e.product_id = p.id and e.status = 'approved' and o.active), '{}')
  where p.id = p_product;
$$;
revoke all on function public.refresh_product_offers(uuid) from public, anon, authenticated;

create or replace function public.offer_entries_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_product_offers(coalesce(new.product_id, old.product_id));
  return null;
end $$;
drop trigger if exists offer_entries_sync on public.offer_entries;
create trigger offer_entries_sync after insert or update or delete on public.offer_entries
  for each row execute function public.offer_entries_sync();

create or replace function public.offers_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_product_offers(e.product_id) from public.offer_entries e where e.offer_slug = coalesce(new.slug, old.slug);
  return null;
end $$;
drop trigger if exists offers_sync on public.offers;
create trigger offers_sync after update of active on public.offers
  for each row execute function public.offers_sync();

-- Team decision (service role / SQL editor).
create or replace function public.review_offer_entry(p_entry bigint, p_approve boolean, p_note text default '')
returns void language sql volatile security definer set search_path = public as $$
  update public.offer_entries set status = case when p_approve then 'approved' else 'rejected' end,
    note = left(coalesce(p_note, ''), 300) where id = p_entry;
$$;
revoke all on function public.review_offer_entry(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.review_offer_entry(bigint, boolean, text) to service_role;

-- ---------------------------------------------------------------- existing tags become entries
alter table public.products drop constraint if exists products_tags_check;
insert into public.offer_entries (offer_slug, product_id, shop_id, status, reviewed_at)
select t.slug, p.id, p.shop_id, case when s.is_demo then 'approved' else 'pending' end,
       case when s.is_demo then now() end
from public.products p join public.shops s on s.id = p.shop_id
cross join lateral unnest(p.tags) as t(slug)
where t.slug in (select slug from public.offers)
on conflict (offer_slug, product_id) do nothing;
update public.products set tags = '{}' where tags <> '{}';
do $$ begin
  perform public.refresh_product_offers(product_id) from (select distinct product_id from public.offer_entries) x;
end $$;

-- shops can no longer write tags themselves
create or replace function public.products_tags_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.tags := '{}'; else new.tags := old.tags; end if;
  end if;
  return new;
end $$;
drop trigger if exists products_tags_guard on public.products;
create trigger products_tags_guard before insert or update on public.products
  for each row execute function public.products_tags_guard();
