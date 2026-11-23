-- The whole marketplace is masked while Bledify is invite-only: no catalog, shop or order data for anyone
-- who is not a signed-in member, whether through the website or directly through the database API.

-- 1. Visitors (anon key) lose read access to the catalog.
revoke execute on function public.get_public_shop(text) from public, anon;
grant execute on function public.get_public_shop(text) to authenticated, service_role;
revoke execute on function public.public_cart(uuid[]) from public, anon;
grant execute on function public.public_cart(uuid[]) to authenticated, service_role;
revoke execute on function public.public_home() from public, anon;
grant execute on function public.public_home() to authenticated, service_role;
revoke execute on function public.public_product(uuid) from public, anon;
grant execute on function public.public_product(uuid) to authenticated, service_role;
revoke execute on function public.public_products(text, text, int, int, text, text, int) from public, anon;
grant execute on function public.public_products(text, text, int, int, text, text, int) to authenticated, service_role;
revoke execute on function public.public_sellers(text, text, text, text, int, int) from public, anon;
grant execute on function public.public_sellers(text, text, text, text, int, int) to authenticated, service_role;
revoke execute on function public.public_nearby_shops(int, text, int) from public, anon;
grant execute on function public.public_nearby_shops(int, text, int) to authenticated, service_role;
revoke execute on function public.subcategory_counts(text) from public, anon;
grant execute on function public.subcategory_counts(text) to authenticated, service_role;
revoke execute on function public.track_order(text, text) from public, anon;
grant execute on function public.track_order(text, text) to authenticated, service_role;
revoke select on public.offers from anon;
revoke select on public.home_banners from anon;

-- 2. Every API request from a visitor or a signed-in account without access is refused before it runs
--    (PostgREST pre-request hook), except the few calls the invitation page needs.
create or replace function public.gate_request()
returns void language plpgsql stable security definer set search_path = public as $$
declare
  r text := coalesce(nullif(current_setting('role', true), 'none'),
                     nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
  p text := coalesce(current_setting('request.path', true), '');
  fn text := case when p like '%/rpc/%' then regexp_replace(p, '^.*/rpc/', '') else '' end;
begin
  if r not in ('anon', 'authenticated') or not public.invite_only() then return; end if;
  if fn in ('invite_only', 'check_invite', 'request_access') then return; end if;
  if r = 'authenticated' and fn in ('my_access', 'redeem_invite', 'my_settings', 'save_my_settings') then return; end if;
  if r = 'authenticated' and public.has_access(auth.uid()) then return; end if;
  raise exception 'NO_ACCESS' using errcode = '42501', hint = 'Bledify is invite-only';
end $$;
grant execute on function public.gate_request() to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    begin
      alter role authenticator set pgrst.db_pre_request = 'public.gate_request';
      notify pgrst, 'reload config';
    exception when others then
      raise warning 'pre-request hook not set: %', sqlerrm;
    end;
  end if;
end $$;
