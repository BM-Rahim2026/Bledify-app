-- Invite-only access. A person can use Bledify when they are a member (joined with an invitation, or had an
-- account before this change) or an admin. The team creates invitations without limit; each member gets a
-- few (platform_settings.member_invite_quota). Visitors without an invitation can request access.

alter table public.platform_settings add column if not exists invite_only boolean not null default true;
alter table public.platform_settings add column if not exists member_invite_quota int not null default 5
  check (member_invite_quota between 0 and 100);

-- ---------------------------------------------------------------- invitations
create table if not exists public.invites (
  id bigserial primary key,
  code text not null unique check (code ~ '^[23456789A-HJ-NP-Z]{8}$'),
  created_by uuid references auth.users (id) on delete set null,   -- null = the team (SQL)
  by_team boolean not null default false,
  max_uses int not null default 1 check (max_uses between 1 and 10000),
  uses int not null default 0,
  note text not null default '' check (length(note) <= 200),
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists invites_creator_idx on public.invites (created_by, created_at desc);
alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;

-- 8 characters without look-alikes (0/O, 1/I/L), from the strong random generator behind gen_random_uuid().
create or replace function public.new_invite_code()
returns text language plpgsql volatile as $$
declare
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  h text; c text;
begin
  loop
    h := replace(gen_random_uuid()::text, '-', '');
    c := '';
    for i in 0..7 loop
      c := c || substr(alphabet, (('x' || substr(h, i * 2 + 1, 2))::bit(8)::int % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.invites where code = c);
  end loop;
  return c;
end $$;
revoke all on function public.new_invite_code() from public, anon, authenticated;

-- "bled-7k2m 9xqp" → "BLED7K2M"-style canonical form (letters and digits only, upper case)
create or replace function public.norm_invite(p text)
returns text language sql immutable as $$ select regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g') $$;

create or replace function public.invite_usable(i public.invites)
returns boolean language sql stable as $$
  select not i.revoked and i.uses < i.max_uses and (i.expires_at is null or i.expires_at > now())
$$;

-- ---------------------------------------------------------------- members
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  invite_id bigint references public.invites (id) on delete set null,
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now()
);
alter table public.members enable row level security;
revoke all on public.members from anon, authenticated;

-- everyone who already had an account keeps access
insert into public.members (user_id, joined_at) select id, created_at from auth.users on conflict do nothing;

create or replace function public.has_access(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, auth as $$
  select p_user is not null and (
    exists (select 1 from public.members where user_id = p_user)
    or exists (select 1 from public.admins where user_id = p_user)
    or exists (select 1 from auth.users u join public.admin_emails e on lower(e.email) = lower(u.email)
               where u.id = p_user and u.email_confirmed_at is not null))
$$;
revoke all on function public.has_access(uuid) from public, anon, authenticated;

-- Is the gate on? (read by the site's request gate; cached there for a minute)
create or replace function public.invite_only()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select invite_only from public.platform_settings), true)
$$;
grant execute on function public.invite_only() to anon, authenticated;

create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('access', public.has_access(auth.uid()), 'invite_only', public.invite_only())
$$;
grant execute on function public.my_access() to authenticated;

-- Is this code usable? (anyone; reveals nothing else)
create or replace function public.check_invite(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.invite_usable(i) from public.invites i where i.code = public.norm_invite(p_code)), false)
$$;
grant execute on function public.check_invite(text) to anon, authenticated;

-- The signed-in person joins with a code. Already a member → true without using the code.
create or replace function public.redeem_invite(p_code text)
returns boolean language plpgsql volatile security definer set search_path = public, auth as $$
declare i public.invites; who text;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  if public.has_access(auth.uid()) then return true; end if;
  select * into i from public.invites where code = public.norm_invite(p_code) for update;
  if not found or not public.invite_usable(i) then raise exception 'INVALID_INVITE' using errcode = 'P0002'; end if;
  update public.invites set uses = uses + 1 where id = i.id;
  insert into public.members (user_id, invite_id, invited_by) values (auth.uid(), i.id, i.created_by);
  select coalesce(nullif(raw_user_meta_data->>'full_name', ''), split_part(email, '@', 1)) into who from auth.users where id = auth.uid();
  if i.created_by is not null and not i.by_team then
    perform public.notify(i.created_by, 'invite_used', jsonb_build_object('name', coalesce(who, '')), '/invitations');
  end if;
  return true;
end $$;
grant execute on function public.redeem_invite(text) to authenticated;

-- ---------------------------------------------------------------- members' own invitations
create or replace function public.my_invites()
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'quota', (select member_invite_quota from public.platform_settings),
    'created', (select count(*) from public.invites where created_by = auth.uid() and not by_team),
    'access', public.has_access(auth.uid()),
    'invites', coalesce((select jsonb_agg(jsonb_build_object(
        'code', i.code, 'uses', i.uses, 'max_uses', i.max_uses, 'expires_at', i.expires_at, 'revoked', i.revoked,
        'created_at', i.created_at, 'usable', public.invite_usable(i),
        'joined', (select coalesce(jsonb_agg(coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1))), '[]'::jsonb)
                   from public.members m join auth.users u on u.id = m.user_id where m.invite_id = i.id))
      order by i.created_at desc) from public.invites i where i.created_by = auth.uid() and not i.by_team), '[]'::jsonb))
$$;
grant execute on function public.my_invites() to authenticated;

-- A member creates one invitation (single use, 30 days), within their quota.
create or replace function public.create_my_invite()
returns text language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  if not public.has_access(auth.uid()) then raise exception 'NO_ACCESS' using errcode = '42501'; end if;
  if (select count(*) from public.invites where created_by = auth.uid() and not by_team)
     >= (select member_invite_quota from public.platform_settings) then
    raise exception 'INVITE_QUOTA' using errcode = 'P0429';
  end if;
  c := public.new_invite_code();
  insert into public.invites (code, created_by, max_uses, expires_at) values (c, auth.uid(), 1, now() + interval '30 days');
  return c;
end $$;
grant execute on function public.create_my_invite() to authenticated;

-- ---------------------------------------------------------------- access requests (visitors without a code)
create table if not exists public.access_requests (
  id bigserial primary key,
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  contact text not null check (length(trim(contact)) between 5 and 120),   -- phone or email
  wilaya text not null default '',
  role text not null default 'buyer' check (role in ('buyer', 'seller')),
  message text not null default '' check (length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'invited', 'declined')),
  invite_id bigint references public.invites (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists access_requests_status_idx on public.access_requests (status, created_at desc);
alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon, authenticated;

create or replace function public.request_access(p_name text, p_contact text, p_wilaya text default '',
  p_role text default 'buyer', p_message text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
declare c text := lower(regexp_replace(trim(coalesce(p_contact, '')), '\s+', '', 'g'));
begin
  -- one pending request per contact; a global brake against floods
  if exists (select 1 from public.access_requests where status = 'pending' and contact = c) then return; end if;
  if (select count(*) from public.access_requests where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'RATE_LIMIT' using errcode = 'P0429';
  end if;
  insert into public.access_requests (full_name, contact, wilaya, role, message)
  values (trim(p_name), c, coalesce(p_wilaya, ''), coalesce(nullif(p_role, ''), 'buyer'), coalesce(p_message, ''));
end $$;
grant execute on function public.request_access(text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- the team
create or replace function public.admin_invite_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select jsonb_build_object('invite_only', invite_only, 'member_invite_quota', member_invite_quota,
            'members', (select count(*) from public.members),
            'pending_requests', (select count(*) from public.access_requests where status = 'pending'))
          from public.platform_settings);
end $$;

create or replace function public.admin_save_invite_settings(p_invite_only boolean, p_quota int)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.platform_settings set invite_only = coalesce(p_invite_only, invite_only),
    member_invite_quota = coalesce(p_quota, member_invite_quota);
end $$;

-- p_status: '' all | usable | used | revoked; p_source: '' | team | members
create or replace function public.admin_invites(p_status text default '', p_source text default '')
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select i.id, i.code, i.by_team, i.max_uses, i.uses, i.note, i.expires_at, i.revoked, i.created_at,
      public.invite_usable(i) usable, u.email creator_email,
      (select count(*) from public.members m where m.invite_id = i.id) joined
    from public.invites i left join auth.users u on u.id = i.created_by
    where (p_source = '' or (p_source = 'team') = i.by_team)
      and (p_status = '' or (p_status = 'usable' and public.invite_usable(i)) or (p_status = 'used' and i.uses > 0)
           or (p_status = 'revoked' and i.revoked))
    limit 1000) x), '[]'::jsonb);
end $$;

-- Creates p_count codes (each usable p_max_uses times, valid p_days days or forever when null).
create or replace function public.admin_create_invites(p_count int, p_max_uses int default 1, p_note text default '', p_days int default null)
returns text[] language plpgsql volatile security definer set search_path = public as $$
declare codes text[] := '{}'; c text;
begin
  perform public.require_admin();
  if p_count not between 1 and 200 then raise exception 'INVALID_COUNT' using errcode = '22023'; end if;
  for k in 1..p_count loop
    c := public.new_invite_code();
    insert into public.invites (code, created_by, by_team, max_uses, note, expires_at)
    values (c, auth.uid(), true, greatest(coalesce(p_max_uses, 1), 1), coalesce(p_note, ''),
            case when p_days is null then null else now() + make_interval(days => p_days) end);
    codes := codes || c;
  end loop;
  return codes;
end $$;

create or replace function public.admin_revoke_invite(p_id bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.invites set revoked = true where id = p_id;
end $$;

create or replace function public.admin_access_requests(p_status text default 'pending')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('code', i.code) order by r.created_at desc)
    from public.access_requests r left join public.invites i on i.id = r.invite_id
    where p_status = '' or r.status = p_status), '[]'::jsonb);
end $$;

-- Accept a request: creates a single-use code (30 days) for it and returns the code to send.
create or replace function public.admin_invite_request(p_id bigint)
returns text language plpgsql volatile security definer set search_path = public as $$
declare r public.access_requests; c text; iid bigint;
begin
  perform public.require_admin();
  select * into r from public.access_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if r.invite_id is not null then return (select code from public.invites where id = r.invite_id); end if;
  c := public.new_invite_code();
  insert into public.invites (code, created_by, by_team, max_uses, note, expires_at)
  values (c, auth.uid(), true, 1, left(r.full_name || ' · ' || r.contact, 200), now() + interval '30 days') returning id into iid;
  update public.access_requests set status = 'invited', invite_id = iid, decided_at = now() where id = p_id;
  return c;
end $$;

create or replace function public.admin_decline_request(p_id bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.access_requests set status = 'declined', decided_at = now() where id = p_id and status = 'pending';
end $$;

-- the team's to-do list now includes access requests
create or replace function public.todo_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'applications', (select count(*) from public.shops where status = 'pending'),
    'review_queue', (select count(*) from public.products p join public.shops s on s.id = p.shop_id
                     where p.reviewed_at is null and not p.blocked and s.status = 'approved' and not s.verified),
    'reports', (select count(*) from public.reports where status = 'open'),
    'refunds', (select count(*) from public.orders where payment_status = 'refund_due'),
    'offers', (select count(*) from public.offer_entries where status = 'pending'),
    'access_requests', (select count(*) from public.access_requests where status = 'pending'))
$$;
revoke all on function public.todo_counts() from public, anon, authenticated;

-- a new shop needs access (the order route checks it for buyers)
create or replace function public.shops_require_access()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- signed-in requests only (the team / service role / SQL have no auth.uid())
  if auth.uid() is not null and not public.has_access(auth.uid()) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists shops_require_access on public.shops;
create trigger shops_require_access before insert on public.shops
  for each row execute function public.shops_require_access();

drop trigger if exists audit_invites on public.invites;
create trigger audit_invites after update on public.invites for each row
  execute function public.audit_admin_change('revoked', 'max_uses');
drop trigger if exists audit_access_requests on public.access_requests;
create trigger audit_access_requests after update on public.access_requests for each row
  execute function public.audit_admin_change('status');

do $$
declare f text;
begin
  foreach f in array array['admin_invite_settings()', 'admin_save_invite_settings(boolean, int)', 'admin_invites(text, text)',
    'admin_create_invites(int, int, text, int)', 'admin_revoke_invite(bigint)', 'admin_access_requests(text)',
    'admin_invite_request(bigint)', 'admin_decline_request(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
