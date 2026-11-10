-- Buyers' delivery address book: several addresses, one default, chosen at checkout.
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null default 'home' check (label in ('home', 'work', 'family', 'other')),
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  phone text not null check (phone ~ '^0[5-7][0-9]{8}$'),
  wilaya text not null check (public.wilaya_code(wilaya) between 1 and 58),
  commune text not null check (length(trim(commune)) between 1 and 80),
  address text not null default '' check (length(address) <= 300),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id, is_default desc, updated_at desc);
alter table public.addresses enable row level security;
revoke all on public.addresses from anon, authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- At most 10 per person; the first one is the default; owner cannot change.
create or replace function public.addresses_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.addresses where user_id = new.user_id) >= 10 then
      raise exception 'TOO_MANY_ADDRESSES' using errcode = 'P0429';
    end if;
    if not exists (select 1 from public.addresses where user_id = new.user_id) then new.is_default := true; end if;
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.full_name := trim(new.full_name); new.commune := trim(new.commune); new.address := trim(new.address);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists addresses_before_write on public.addresses;
create trigger addresses_before_write before insert or update on public.addresses
  for each row execute function public.addresses_before_write();

-- Only one default; when the default is deleted, the most recent address takes over.
create or replace function public.addresses_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'DELETE' and new.is_default then
    update public.addresses set is_default = false where user_id = new.user_id and id <> new.id and is_default;
  elsif tg_op = 'DELETE' and old.is_default then
    update public.addresses set is_default = true
    where id = (select id from public.addresses where user_id = old.user_id order by updated_at desc limit 1);
  end if;
  return null;
end $$;
drop trigger if exists addresses_after_write on public.addresses;
create trigger addresses_after_write after insert or update of is_default or delete on public.addresses
  for each row execute function public.addresses_after_write();
