-- Admins can also be granted by email: the right applies once that address is confirmed
-- (so nobody can claim it by signing up first with someone else's email).
create table if not exists public.admin_emails (
  email text primary key check (email = lower(trim(email)) and email like '%@%'),
  created_at timestamptz not null default now()
);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;

insert into public.admin_emails (email) values ('northstarmkg@gmail.com') on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is not null and (
    exists (select 1 from public.admins where user_id = auth.uid())
    or exists (select 1 from auth.users u join public.admin_emails a on a.email = lower(u.email)
               where u.id = auth.uid() and u.email_confirmed_at is not null))
$$;

-- an existing, confirmed account becomes admin right away
insert into public.admins (user_id)
select u.id from auth.users u join public.admin_emails a on a.email = lower(u.email)
where u.email_confirmed_at is not null
on conflict do nothing;
