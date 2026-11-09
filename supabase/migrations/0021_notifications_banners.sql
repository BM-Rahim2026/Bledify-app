-- In-app notifications (bell) with a daily email digest, graduated warnings to shops,
-- and the home carousel managed by the team.

-- ---------------------------------------------------------------- user preferences
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lang text not null default 'fr' check (lang in ('fr', 'ar')),
  email_digest boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon, authenticated;

create or replace function public.my_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('lang', lang, 'email_digest', email_digest) from public.user_settings where user_id = auth.uid()),
                  jsonb_build_object('lang', 'fr', 'email_digest', true))
$$;

-- p_lang / p_email_digest: null keeps the current value
create or replace function public.save_my_settings(p_lang text default null, p_email_digest boolean default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN' using errcode = '42501'; end if;
  insert into public.user_settings (user_id, lang, email_digest)
  values (auth.uid(), coalesce(p_lang, 'fr'), coalesce(p_email_digest, true))
  on conflict (user_id) do update set
    lang = coalesce(p_lang, user_settings.lang),
    email_digest = coalesce(p_email_digest, user_settings.email_digest),
    updated_at = now();
end $$;

-- ---------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  params jsonb not null default '{}',
  link text not null default '',
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_digest_idx on public.notifications (created_at) where read_at is null and emailed_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

-- internal: written by triggers and admin functions only
create or replace function public.notify(p_user uuid, p_kind text, p_params jsonb default '{}', p_link text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, params, link) values (p_user, p_kind, coalesce(p_params, '{}'), coalesce(p_link, ''));
end $$;
revoke all on function public.notify(uuid, text, jsonb, text) from public, anon, authenticated;

create or replace function public.my_notifications(p_limit int default 50)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'params', params, 'link', link,
                                               'read', read_at is not null, 'created_at', created_at) order by created_at desc), '[]'::jsonb)
  from (select * from public.notifications where user_id = auth.uid()
        order by created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) n
$$;

create or replace function public.my_unread_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications where user_id = auth.uid() and read_at is null
$$;

-- p_ids null = all
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void language sql volatile security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;

-- ---------------------------------------------------------------- events → notifications
-- shop application decided, suspension
create or replace function public.notify_shop_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public.notify(new.owner_id, 'shop_' || new.status, jsonb_build_object('shop', new.name, 'note', coalesce(new.review_note, '')), '/seller');
  end if;
  if new.suspended is distinct from old.suspended then
    perform public.notify(new.owner_id, case when new.suspended then 'shop_suspended' else 'shop_unsuspended' end,
                          jsonb_build_object('shop', new.name, 'reason', coalesce(new.suspended_reason, '')), '/seller');
  end if;
  return null;
end $$;
drop trigger if exists notify_shop_change on public.shops;
create trigger notify_shop_change after update of status, suspended on public.shops
  for each row execute function public.notify_shop_change();

-- listing hidden / restored by the team
create or replace function public.notify_product_blocked()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.blocked is distinct from old.blocked then
    perform public.notify((select owner_id from public.shops where id = new.shop_id),
                          case when new.blocked then 'product_blocked' else 'product_unblocked' end,
                          jsonb_build_object('product', new.name, 'reason', coalesce(new.block_reason, '')), '/seller/products');
  end if;
  return null;
end $$;
drop trigger if exists notify_product_blocked on public.products;
create trigger notify_product_blocked after update of blocked on public.products
  for each row execute function public.notify_product_blocked();

-- offer proposal decided
create or replace function public.notify_offer_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public.notify((select owner_id from public.shops where id = new.shop_id), 'offer_' || new.status,
      jsonb_build_object('product', (select name from public.products where id = new.product_id),
                         'title_fr', (select title_fr from public.offers where slug = new.offer_slug),
                         'title_ar', (select title_ar from public.offers where slug = new.offer_slug),
                         'note', new.note),
      '/seller/products');
  end if;
  return null;
end $$;
drop trigger if exists notify_offer_entry on public.offer_entries;
create trigger notify_offer_entry after update of status on public.offer_entries
  for each row execute function public.notify_offer_entry();

-- payout sent
create or replace function public.notify_payout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'payout' then
    perform public.notify((select owner_id from public.shops where id = new.shop_id), 'payout_sent',
                          jsonb_build_object('amount', -new.amount_dzd, 'reference', new.note), '/seller/earnings');
  end if;
  return null;
end $$;
drop trigger if exists notify_payout on public.seller_ledger;
create trigger notify_payout after insert on public.seller_ledger
  for each row execute function public.notify_payout();

-- orders: new (visible) order for the shop; shipped / delivered / cancelled for the buyer
create or replace function public.notify_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare shop_name text;
begin
  if new.source <> 'shop' then return null; end if;
  select name into shop_name from public.shops where id = new.shop_id;
  if (tg_op = 'INSERT' and new.payment_status not in ('pending', 'failed'))
     or (tg_op = 'UPDATE' and old.payment_status = 'pending' and new.payment_status = 'paid') then
    perform public.notify(new.owner_id, 'order_new',
      jsonb_build_object('number', new.number, 'total', new.total_dzd, 'name', new.customer_name), '/seller/orders/' || new.id);
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('confirmed', 'shipped', 'delivered', 'cancelled') then
    perform public.notify(new.customer_id, 'order_' || new.status,
      jsonb_build_object('number', new.number, 'shop', shop_name), '/orders');
  end if;
  return null;
end $$;
drop trigger if exists notify_order on public.orders;
create trigger notify_order after insert or update of status, payment_status on public.orders
  for each row execute function public.notify_order();

-- report / dispute handled
create or replace function public.notify_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('resolved', 'dismissed') then
    perform public.notify(new.reporter_id, 'report_' || new.status,
      jsonb_build_object('kind', new.kind, 'resolution', new.resolution), case when new.kind = 'order' then '/orders' else '' end);
  end if;
  return null;
end $$;
drop trigger if exists notify_report on public.reports;
create trigger notify_report after update of status on public.reports
  for each row execute function public.notify_report();

-- ---------------------------------------------------------------- graduated warnings to shops
-- warning → final warning → suspension (admin_update_shop). Each is shown to the shop.
create table if not exists public.shop_warnings (
  id bigserial primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  level text not null check (level in ('warning', 'final')),
  reason text not null check (reason in ('imported', 'late_shipping', 'cancellations', 'quality', 'listing_rules',
                                          'outside_contact', 'behaviour', 'other')),
  details text not null default '' check (length(details) <= 1000),
  admin_email text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists shop_warnings_shop_idx on public.shop_warnings (shop_id, created_at desc);
alter table public.shop_warnings enable row level security;
revoke all on public.shop_warnings from anon, authenticated;

create or replace function public.admin_warn_shop(p_shop uuid, p_level text, p_reason text, p_details text default '')
returns bigint language plpgsql volatile security definer set search_path = public, auth as $$
declare wid bigint; s record; me text;
begin
  perform public.require_admin();
  select * into s from public.shops where id = p_shop;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select email into me from auth.users where id = auth.uid();
  insert into public.shop_warnings (shop_id, level, reason, details, admin_email)
  values (p_shop, p_level, p_reason, coalesce(p_details, ''), coalesce(me, '')) returning id into wid;
  perform public.notify(s.owner_id, 'shop_warning_' || p_level,
                        jsonb_build_object('shop', s.name, 'reason', p_reason, 'details', coalesce(p_details, '')), '/seller');
  insert into public.admin_audit (admin_id, admin_email, action, target_type, target_id, details)
  values (auth.uid(), coalesce(me, ''), 'warn', 'shops', p_shop::text,
          jsonb_build_object('level', p_level, 'reason', p_reason, 'details', coalesce(p_details, '')));
  return wid;
end $$;

create or replace function public.admin_shop_warnings(p_shop uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from public.shop_warnings w where w.shop_id = p_shop), '[]'::jsonb);
end $$;

-- the shop's own warnings of the last 6 months
create or replace function public.my_shop_warnings()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'level', w.level, 'reason', w.reason, 'details', w.details,
                                               'created_at', w.created_at) order by w.created_at desc), '[]'::jsonb)
  from public.shop_warnings w join public.shops s on s.id = w.shop_id
  where s.owner_id = auth.uid() and w.created_at > now() - interval '180 days'
$$;

-- ---------------------------------------------------------------- home carousel
create table if not exists public.home_banners (
  id bigserial primary key,
  title_fr text not null check (length(title_fr) between 1 and 120),
  title_ar text not null check (length(title_ar) between 1 and 120),
  sub_fr text not null default '' check (length(sub_fr) <= 200),
  sub_ar text not null default '' check (length(sub_ar) <= 200),
  image text not null check (image ~ '^(https://|/)'),
  href text not null default '/explore' check (href ~ '^/'),
  position int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.home_banners enable row level security;
revoke all on public.home_banners from anon, authenticated;
grant select on public.home_banners to anon, authenticated;
drop policy if exists home_banners_live on public.home_banners;
create policy home_banners_live on public.home_banners for select to anon, authenticated
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

drop trigger if exists audit_home_banners on public.home_banners;
create trigger audit_home_banners after insert or update or delete on public.home_banners for each row
  execute function public.audit_admin_change('title_fr', 'title_ar', 'image', 'href', 'position', 'active', 'starts_at', 'ends_at');

create or replace function public.admin_banners()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object(
      'live', b.active and (b.starts_at is null or b.starts_at <= now()) and (b.ends_at is null or b.ends_at > now()))
    order by b.position, b.id) from public.home_banners b), '[]'::jsonb);
end $$;

-- p: {id?, title_fr, title_ar, sub_fr, sub_ar, image, href, position, active, starts_at, ends_at}
create or replace function public.admin_save_banner(p jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare bid bigint := nullif(p->>'id', '')::bigint;
begin
  perform public.require_admin();
  if bid is null then
    insert into public.home_banners (title_fr, title_ar, sub_fr, sub_ar, image, href, position, active, starts_at, ends_at)
    values (trim(p->>'title_fr'), trim(p->>'title_ar'), coalesce(trim(p->>'sub_fr'), ''), coalesce(trim(p->>'sub_ar'), ''),
            trim(p->>'image'), coalesce(nullif(trim(p->>'href'), ''), '/explore'), coalesce((p->>'position')::int, 0),
            coalesce((p->>'active')::boolean, true), nullif(p->>'starts_at', '')::timestamptz, nullif(p->>'ends_at', '')::timestamptz)
    returning id into bid;
  else
    update public.home_banners set
      title_fr = trim(p->>'title_fr'), title_ar = trim(p->>'title_ar'),
      sub_fr = coalesce(trim(p->>'sub_fr'), ''), sub_ar = coalesce(trim(p->>'sub_ar'), ''),
      image = trim(p->>'image'), href = coalesce(nullif(trim(p->>'href'), ''), '/explore'),
      position = coalesce((p->>'position')::int, 0), active = coalesce((p->>'active')::boolean, true),
      starts_at = nullif(p->>'starts_at', '')::timestamptz, ends_at = nullif(p->>'ends_at', '')::timestamptz
    where id = bid;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  return bid;
end $$;

create or replace function public.admin_delete_banner(p_id bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.home_banners where id = p_id;
end $$;

-- ---------------------------------------------------------------- daily email digest (service role)
create or replace function public.todo_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'applications', (select count(*) from public.shops where status = 'pending'),
    'review_queue', (select count(*) from public.products p join public.shops s on s.id = p.shop_id
                     where p.reviewed_at is null and not p.blocked and s.status = 'approved' and not s.verified),
    'reports', (select count(*) from public.reports where status = 'open'),
    'refunds', (select count(*) from public.orders where payment_status = 'refund_due'),
    'offers', (select count(*) from public.offer_entries where status = 'pending'))
$$;
revoke all on function public.todo_counts() from public, anon, authenticated;

create or replace function public.admin_counts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return public.todo_counts();
end $$;

-- Users with unread notifications not yet emailed (last 7 days), with their email and language.
create or replace function public.digest_pending(p_limit int default 300)
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select n.user_id, u.email, coalesce(us.lang, 'fr') lang,
           jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'params', n.params, 'link', n.link) order by n.created_at desc) items
    from public.notifications n
    join auth.users u on u.id = n.user_id and u.email is not null and u.email_confirmed_at is not null
    left join public.user_settings us on us.user_id = n.user_id
    where n.read_at is null and n.emailed_at is null and n.created_at > now() - interval '7 days'
      and coalesce(us.email_digest, true)
    group by n.user_id, u.email, us.lang
    limit greatest(coalesce(p_limit, 300), 1)) x
$$;

create or replace function public.digest_mark_sent(p_ids bigint[])
returns void language sql volatile security definer set search_path = public as $$
  update public.notifications set emailed_at = now() where id = any (p_ids)
$$;

-- What waits for the team, and where to send it.
create or replace function public.team_digest()
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'counts', public.todo_counts(),
    'emails', coalesce((select jsonb_agg(distinct e) from (
        select lower(email) e from public.admin_emails
        union select lower(u.email) from public.admins a join auth.users u on u.id = a.user_id where u.email is not null) z), '[]'::jsonb))
$$;

revoke all on function public.digest_pending(int) from public, anon, authenticated;
revoke all on function public.digest_mark_sent(bigint[]) from public, anon, authenticated;
revoke all on function public.team_digest() from public, anon, authenticated;
grant execute on function public.digest_pending(int) to service_role;
grant execute on function public.digest_mark_sent(bigint[]) to service_role;
grant execute on function public.team_digest() to service_role;

do $$
declare f text;
begin
  foreach f in array array['my_settings()', 'save_my_settings(text, boolean)', 'my_notifications(int)', 'my_unread_count()',
    'mark_notifications_read(bigint[])', 'my_shop_warnings()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['admin_warn_shop(uuid, text, text, text)', 'admin_shop_warnings(uuid)', 'admin_banners()',
    'admin_save_banner(jsonb)', 'admin_delete_banner(bigint)', 'admin_counts()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
