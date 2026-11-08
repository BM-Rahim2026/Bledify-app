-- Marketplace payments: every payment goes to Bledify (escrow), then Bledify pays the shop.
-- * Each product accepts cash on delivery and/or card, and may require an online deposit (%).
-- * Card / deposit orders stay hidden from the shop until paid (payment_status 'pending').
-- * On delivery the shop is credited (items + delivery fee) minus the commission; the money
--   becomes payable after the hold period. Payouts and refunds are recorded by the team.

-- ---------------------------------------------------------------- settings
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  commission_pct numeric(5,2) not null default 10 check (commission_pct between 0 and 100),
  payout_delay_days int not null default 7 check (payout_delay_days between 0 and 90),
  unpaid_expiry_minutes int not null default 120 check (unpaid_expiry_minutes between 10 and 10080)
);
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;

alter table public.shops add column if not exists commission_pct numeric(5,2)
  check (commission_pct is null or commission_pct between 0 and 100);
-- where the team sends the shop's money (private, like the phone numbers)
alter table public.shops add column if not exists payout_method text not null default ''
  check (payout_method in ('', 'ccp', 'rib', 'baridimob'));
alter table public.shops add column if not exists payout_account text not null default ''
  check (length(payout_account) <= 60);
alter table public.shops add column if not exists payout_holder text not null default ''
  check (length(payout_holder) <= 80);

-- ---------------------------------------------------------------- products
alter table public.products add column if not exists pay_cod boolean not null default true;
alter table public.products add column if not exists pay_card boolean not null default true;
alter table public.products add column if not exists deposit_pct int not null default 0
  check (deposit_pct between 0 and 100);
alter table public.products drop constraint if exists products_payment_check;
alter table public.products add constraint products_payment_check
  check ((pay_cod or pay_card) and (deposit_pct = 0 or pay_card));

-- ---------------------------------------------------------------- orders
alter table public.orders add column if not exists payment_method text not null default 'cod'
  check (payment_method in ('cod', 'card'));
alter table public.orders add column if not exists amount_online_dzd int not null default 0 check (amount_online_dzd >= 0);
alter table public.orders add column if not exists amount_cod_dzd int not null default 0;
alter table public.orders add column if not exists payment_status text not null default 'none'
  check (payment_status in ('none', 'pending', 'paid', 'failed', 'refund_due', 'refunded'));
alter table public.orders add column if not exists checkout_id text not null default '';
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists commission_dzd int not null default 0;
alter table public.orders add column if not exists seller_net_dzd int not null default 0;
alter table public.orders add column if not exists payout_available_at timestamptz;
create index if not exists orders_checkout_idx on public.orders (checkout_id) where checkout_id <> '';
update public.orders set amount_cod_dzd = total_dzd where amount_cod_dzd = 0 and amount_online_dzd = 0;

-- Commission % and hold period for a shop (readable inside the order trigger whoever runs it).
create or replace function public.payout_terms(p_shop uuid, out pct numeric, out delay int)
language sql stable security definer set search_path = public as $$
  select coalesce(s.commission_pct, ps.commission_pct), ps.payout_delay_days
  from public.platform_settings ps left join public.shops s on s.id = p_shop
$$;
revoke all on function public.payout_terms(uuid) from public, anon;
grant execute on function public.payout_terms(uuid) to authenticated, service_role;

-- Runs after orders_before_write (alphabetical): payment fields are written by the database only.
create or replace function public.orders_payment_guard()
returns trigger language plpgsql as $$
declare
  pct numeric;
  delay int;
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.payment_method := 'cod'; new.amount_online_dzd := 0; new.payment_status := 'none';
      new.checkout_id := ''; new.paid_at := null;
    else
      new.payment_method := old.payment_method; new.amount_online_dzd := old.amount_online_dzd;
      new.payment_status := old.payment_status; new.checkout_id := old.checkout_id; new.paid_at := old.paid_at;
      if old.amount_online_dzd > 0 and (new.items is distinct from old.items or new.delivery_dzd is distinct from old.delivery_dzd) then
        raise exception 'ORDER_PAID_LOCKED' using errcode = '22023';
      end if;
    end if;
    if tg_op = 'UPDATE' then
      new.commission_dzd := old.commission_dzd; new.seller_net_dzd := old.seller_net_dzd;
      new.payout_available_at := old.payout_available_at;
    end if;
  end if;

  new.amount_cod_dzd := greatest(new.total_dzd - new.amount_online_dzd, 0);

  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.source = 'shop' then
    if new.status = 'delivered' then
      select t.pct, t.delay into pct, delay from public.payout_terms(new.shop_id) t;
      new.commission_dzd := round(public.order_items_total(new.items) * pct / 100.0)::int;
      new.seller_net_dzd := new.total_dzd - new.commission_dzd;
      new.payout_available_at := now() + make_interval(days => delay);
    elsif new.status in ('cancelled', 'returned') and new.payment_status = 'paid' then
      new.payment_status := 'refund_due';   -- the team refunds (or keeps the deposit, see resolve_refund)
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_payment_guard on public.orders;
create trigger orders_payment_guard before insert or update on public.orders
  for each row execute function public.orders_payment_guard();

-- Shops never see orders waiting for an online payment.
drop policy if exists orders_owner_all on public.orders;
create policy orders_owner_all on public.orders for all to authenticated
  using (owner_id = auth.uid() and payment_status not in ('pending', 'failed'))
  with check (owner_id = auth.uid()
    and exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- Unpaid card / deposit orders are cancelled after the expiry delay.
create or replace function public.expire_unpaid_orders()
returns void language sql volatile security definer set search_path = public as $$
  update public.orders set payment_status = 'failed', status = 'cancelled'
  where payment_status = 'pending' and status = 'new'
    and created_at < now() - make_interval(mins => (select unpaid_expiry_minutes from public.platform_settings));
$$;
revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;

-- ---------------------------------------------------------------- seller ledger
create table if not exists public.seller_ledger (
  id bigserial primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  kind text not null check (kind in ('sale', 'commission', 'reversal', 'adjustment', 'payout')),
  amount_dzd int not null,
  available_at timestamptz not null default now(),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists seller_ledger_shop_idx on public.seller_ledger (shop_id, created_at desc);
alter table public.seller_ledger enable row level security;
revoke all on public.seller_ledger from anon, authenticated;
grant select on public.seller_ledger to authenticated;
drop policy if exists seller_ledger_own on public.seller_ledger;
create policy seller_ledger_own on public.seller_ledger for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- Ledger entries when an order is delivered, or un-delivered (returned / cancelled afterwards).
create or replace function public.orders_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare items int := public.order_items_total(new.items);
begin
  if new.source <> 'shop' or new.status is not distinct from old.status then return null; end if;
  if new.status = 'delivered' then
    insert into public.seller_ledger (shop_id, order_id, kind, amount_dzd, available_at, note) values
      (new.shop_id, new.id, 'sale', new.total_dzd, new.payout_available_at, new.number),
      (new.shop_id, new.id, 'commission', -new.commission_dzd, new.payout_available_at, new.number);
  elsif old.status = 'delivered' and new.status in ('returned', 'cancelled') then
    insert into public.seller_ledger (shop_id, order_id, kind, amount_dzd, note)
      values (new.shop_id, new.id, 'reversal', -(old.total_dzd - old.commission_dzd), new.number);
  end if;
  return null;
end $$;
drop trigger if exists orders_ledger on public.orders;
create trigger orders_ledger after update of status on public.orders
  for each row execute function public.orders_ledger();

-- The shop's money: on hold, available, paid out, and the latest movements.
create or replace function public.seller_balance()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select * from public.shops where owner_id = auth.uid()),
  l as (select l.* from public.seller_ledger l join s on s.id = l.shop_id)
  select jsonb_build_object(
    'on_hold', coalesce((select sum(amount_dzd) from l where available_at > now() and kind <> 'payout'), 0),
    'available', coalesce((select sum(amount_dzd) from l where available_at <= now()), 0),
    'paid_out', coalesce((select -sum(amount_dzd) from l where kind = 'payout'), 0),
    'commission_pct', (select coalesce(s.commission_pct, ps.commission_pct) from s, public.platform_settings ps),
    'payout_delay_days', (select payout_delay_days from public.platform_settings),
    'payout_method', (select payout_method from s), 'payout_account', (select payout_account from s),
    'payout_holder', (select payout_holder from s),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('kind', x.kind, 'amount_dzd', x.amount_dzd,
        'available_at', x.available_at, 'created_at', x.created_at, 'note', x.note) order by x.created_at desc, x.id desc)
      from (select * from l order by created_at desc, id desc limit 50) x), '[]'::jsonb))
  where exists (select 1 from s)
$$;
revoke all on function public.seller_balance() from public, anon;
grant execute on function public.seller_balance() to authenticated;

-- ---------------------------------------------------------------- team / payment-provider functions (service role)
create or replace function public.attach_checkout(p_order uuid, p_checkout text)
returns void language sql volatile security definer set search_path = public as $$
  update public.orders set checkout_id = p_checkout, payment_status = 'pending'
  where id = p_order and payment_status in ('pending', 'failed') and status = 'new';
$$;

-- Called when the provider confirms a payment (idempotent). Returns {order_id, newly_paid}.
create or replace function public.mark_order_paid(p_checkout text, p_amount int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where checkout_id = p_checkout and checkout_id <> '' for update;
  if o.id is null then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if o.payment_status in ('paid', 'refund_due', 'refunded') then
    return jsonb_build_object('order_id', o.id, 'newly_paid', false);
  end if;
  if p_amount <> o.amount_online_dzd then raise exception 'AMOUNT_MISMATCH' using errcode = '22023'; end if;
  update public.orders set payment_status = case when o.status = 'cancelled' then 'refund_due' else 'paid' end,
    paid_at = now() where id = o.id;
  return jsonb_build_object('order_id', o.id, 'newly_paid', o.status <> 'cancelled');
end $$;

create or replace function public.mark_checkout_failed(p_checkout text)
returns void language sql volatile security definer set search_path = public as $$
  update public.orders set payment_status = 'failed' where checkout_id = p_checkout and payment_status = 'pending';
$$;

-- A buyer's unpaid order, to (re)start the online payment.
create or replace function public.order_to_pay(p_order uuid, p_customer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', o.id, 'number', o.number, 'amount_online_dzd', o.amount_online_dzd,
    'payment_status', o.payment_status, 'checkout_id', o.checkout_id, 'shop_name', s.name)
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.id = p_order and o.customer_id = p_customer and o.status = 'new'
    and o.payment_status in ('pending', 'failed') and o.amount_online_dzd > 0
$$;

-- The team refunds the buyer and may credit the shop (e.g. keep a deposit for food already made).
create or replace function public.resolve_refund(p_order uuid, p_shop_credit int default 0, p_note text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order and payment_status = 'refund_due' for update;
  if o.id is null then raise exception 'NOTHING_TO_REFUND' using errcode = 'P0002'; end if;
  if p_shop_credit < 0 or p_shop_credit > o.amount_online_dzd then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;
  update public.orders set payment_status = 'refunded' where id = o.id;
  if p_shop_credit > 0 then
    insert into public.seller_ledger (shop_id, order_id, kind, amount_dzd, note)
      values (o.shop_id, o.id, 'adjustment', p_shop_credit, coalesce(nullif(p_note, ''), o.number));
  end if;
end $$;

-- The team sent money to the shop (CCP / bank transfer).
create or replace function public.record_payout(p_shop uuid, p_amount int, p_reference text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare avail int;
begin
  select coalesce(sum(amount_dzd), 0) into avail from public.seller_ledger where shop_id = p_shop and available_at <= now();
  if p_amount <= 0 or p_amount > avail then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;
  insert into public.seller_ledger (shop_id, kind, amount_dzd, note) values (p_shop, 'payout', -p_amount, p_reference);
end $$;

revoke all on function public.attach_checkout(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_order_paid(text, int) from public, anon, authenticated;
revoke all on function public.mark_checkout_failed(text) from public, anon, authenticated;
revoke all on function public.order_to_pay(uuid, uuid) from public, anon, authenticated;
revoke all on function public.resolve_refund(uuid, int, text) from public, anon, authenticated;
revoke all on function public.record_payout(uuid, int, text) from public, anon, authenticated;
grant execute on function public.attach_checkout(uuid, text) to service_role;
grant execute on function public.mark_order_paid(text, int) to service_role;
grant execute on function public.mark_checkout_failed(text) to service_role;
grant execute on function public.order_to_pay(uuid, uuid) to service_role;
grant execute on function public.resolve_refund(uuid, int, text) to service_role;
grant execute on function public.record_payout(uuid, int, text) to service_role;
grant execute on function public.expire_unpaid_orders() to service_role;

-- ---------------------------------------------------------------- order placement and public reads
drop function if exists public.place_order(text, text, text, text, text, text, text, jsonb, text, text, uuid);
create or replace function public.place_order(
  p_slug text, p_customer_name text, p_phone text, p_wilaya text, p_commune text,
  p_address text, p_delivery_type text, p_items jsonb, p_note text default '', p_ip text default '',
  p_customer uuid default null, p_payment_method text default 'cod')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.shops;
  ph text := public.normalize_dz_phone(p_phone);
  lines jsonb := '[]'::jsonb;
  it jsonb;
  pr public.products;
  qty int;
  hash text;
  quote jsonb;
  fee int;
  o public.orders;
  line_total int;
  deposit int := 0;
  items_total int := 0;
  online int := 0;
begin
  perform public.expire_unpaid_orders();
  select * into s from public.shops where slug = lower(p_slug);
  if s.id is null then raise exception 'Shop not found' using errcode = 'P0002'; end if;
  if ph is null then raise exception 'INVALID_PHONE' using errcode = '22023'; end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'INVALID_NAME' using errcode = '22023'; end if;
  if length(trim(coalesce(p_wilaya, ''))) = 0 then raise exception 'INVALID_WILAYA' using errcode = '22023'; end if;
  if p_delivery_type not in ('home', 'desk') then raise exception 'INVALID_DELIVERY' using errcode = '22023'; end if;
  if coalesce(p_payment_method, 'cod') not in ('cod', 'card') then raise exception 'INVALID_PAYMENT' using errcode = '22023'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  quote := public.delivery_quote(s, p_wilaya);
  if coalesce((quote->>'off')::boolean, false) then raise exception 'NO_DELIVERY' using errcode = '22023'; end if;
  fee := (quote->>p_delivery_type)::int;

  if coalesce(p_ip, '') <> '' and (select count(*) from public.order_attempts
      where ip = p_ip and at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;
  if (select count(*) from public.order_attempts where phone = ph and at > now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := coalesce((it->>'quantity')::int, 0);
    if qty < 1 or qty > 99 then raise exception 'INVALID_ITEMS' using errcode = '22023'; end if;
    select * into pr from public.products
      where id = (it->>'product_id')::uuid and shop_id = s.id and active;
    if pr.id is null then raise exception 'INVALID_ITEMS' using errcode = '22023'; end if;
    -- every product must accept the chosen payment method
    if coalesce(p_payment_method, 'cod') = 'cod' and not pr.pay_cod then raise exception 'PAYMENT_NOT_ALLOWED' using errcode = '22023'; end if;
    if p_payment_method = 'card' and not pr.pay_card then raise exception 'PAYMENT_NOT_ALLOWED' using errcode = '22023'; end if;
    line_total := pr.price_dzd * qty;
    items_total := items_total + line_total;
    deposit := deposit + ceil(line_total * pr.deposit_pct / 100.0)::int;
    lines := lines || jsonb_build_array(jsonb_build_object(
      'product_id', pr.id, 'name', pr.name, 'unit_price_dzd', pr.price_dzd, 'quantity', qty, 'deposit_pct', pr.deposit_pct));
  end loop;

  select string_agg((l->>'product_id') || 'x' || (l->>'quantity'), ',' order by l->>'product_id')
    into hash from jsonb_array_elements(lines) l;

  if exists (select 1 from public.orders where shop_id = s.id and phone = ph and items_hash = hash
             and payment_status <> 'failed' and created_at > now() - interval '10 minutes') then
    raise exception 'DUPLICATE_ORDER' using errcode = 'P0409';
  end if;

  insert into public.order_attempts (ip, phone) values (coalesce(p_ip, ''), ph);

  -- amount paid online: everything by card, or the deposits (rounded up to 10 DA, at least 100 DA)
  if p_payment_method = 'card' then
    online := items_total + fee;
  elsif deposit > 0 then
    online := least(greatest(ceil(deposit / 10.0)::int * 10, 100), items_total + fee);
  end if;

  insert into public.orders (owner_id, shop_id, customer_id, customer_name, phone, wilaya, commune, address,
      delivery_type, items, delivery_dzd, note, status, source, items_hash,
      payment_method, amount_online_dzd, payment_status)
  values (s.owner_id, s.id, p_customer, trim(p_customer_name), ph, trim(p_wilaya), trim(coalesce(p_commune, '')),
      trim(coalesce(p_address, '')), p_delivery_type, lines, fee, left(coalesce(p_note, ''), 500),
      'new', 'shop', hash, coalesce(p_payment_method, 'cod'), online, case when online > 0 then 'pending' else 'none' end)
  returning * into o;

  return jsonb_build_object('id', o.id, 'number', o.number, 'total_dzd', o.total_dzd,
    'delivery_dzd', o.delivery_dzd, 'items', o.items, 'shop_name', s.name,
    'payment_method', o.payment_method, 'amount_online_dzd', o.amount_online_dzd,
    'amount_cod_dzd', o.amount_cod_dzd, 'payment_status', o.payment_status);
end $$;

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
        'price_dzd', p.price_dzd, 'images', to_jsonb(p.images),
        'pay_cod', p.pay_cod, 'pay_card', p.pay_card, 'deposit_pct', p.deposit_pct) order by p.position, p.created_at)
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

create or replace function public.public_product(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'story', p.story, 'price_dzd', p.price_dzd,
    'images', to_jsonb(p.images), 'category', p.category, 'tags', to_jsonb(p.tags),
    'pay_cod', p.pay_cod, 'pay_card', p.pay_card, 'deposit_pct', p.deposit_pct,
    'shop', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'wilaya', s.wilaya,
      'description', s.description, 'delivery_home_dzd', s.delivery_home_dzd,
      'delivery_desk_dzd', s.delivery_desk_dzd, 'delivery_zones', s.delivery_zones, 'verified', s.verified,
      'logo', s.logo, 'logo_url', s.logo_url, 'category', public.shop_category(s.id),
      'delivered_count', (select count(*) from public.orders o where o.shop_id = s.id and o.status = 'delivered'))
      || public.shop_rating(s.id),
    'reviews', coalesce((
      select jsonb_agg(x.j) from (
        select public.review_json(r) j from public.reviews r
        where r.product_id = p.id and not r.hidden order by r.created_at desc limit 20) x), '[]'::jsonb),
    'related', coalesce((
      select jsonb_agg(x.card) from (
        select public.product_card(p2, s) card from public.products p2
        where p2.shop_id = s.id and p2.active and p2.id <> p.id
        order by p2.position, p2.created_at limit 6) x), '[]'::jsonb)
  ) || (select jsonb_build_object('rating', round(avg(r.rating), 1), 'review_count', count(*))
        from public.reviews r where r.product_id = p.id and not r.hidden)
  from public.products p join public.shops s on s.id = p.shop_id
  where p.id = p_id and p.active
$$;

create or replace function public.my_orders()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status, 'items', o.items,
    'total_dzd', o.total_dzd, 'created_at', o.created_at, 'carrier', o.carrier,
    'tracking_number', o.tracking_number, 'shop_name', s.name, 'shop_slug', s.slug,
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'amount_online_dzd', o.amount_online_dzd, 'amount_cod_dzd', o.amount_cod_dzd,
    'image', (select p.images[1] from public.products p
              where p.id = (o.items->0->>'product_id')::uuid),
    'reviews', coalesce((select jsonb_object_agg(r.product_id, jsonb_build_object('rating', r.rating, 'comment', r.comment))
                         from public.reviews r where r.order_id = o.id), '{}'::jsonb)
  ) order by o.created_at desc), '[]'::jsonb)
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.customer_id = auth.uid() and auth.uid() is not null
$$;
revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb, text, text, uuid, text) to service_role;

-- ---------------------------------------------------------------- demo
-- Made-to-order sweets and dishes ask for a 30 % deposit; the bridal pieces 50 %.
update public.products p set deposit_pct = 30
  from public.shops s where s.id = p.shop_id and s.is_demo and p.category = 'food';
update public.products p set deposit_pct = 50
  from public.shops s where s.id = p.shop_id and s.is_demo and p.category = 'occasions';
