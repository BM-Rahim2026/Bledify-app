// Database tests for the order rules. Needs a PostgreSQL with the Supabase
// stub + migrations applied (see scripts/test-db.sh). TEST_DATABASE_URL picks it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
const skip = !url && "TEST_DATABASE_URL not set";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let db;
let shopA, shopB, p1, p2;
let ipSeq = 0;

async function as(user, fn) {
  // run fn as an authenticated user (or anon / service_role) inside a transaction
  await db.query("begin");
  try {
    if (user === "anon") await db.query("set local role anon");
    else if (user === "service") await db.query("set local role service_role");
    else {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    }
    const r = await fn();
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
const q = async (sql, args) => (await db.query(sql, args)).rows;

async function placeOrder(over = {}) {
  const a = {
    slug: "shop-a", name: "Karim T.", phone: "0661 23 45 67", wilaya: "31 - Oran",
    commune: "Bir El Djir", address: "", type: "desk",
    items: [{ product_id: p1, quantity: 1 }], ip: `10.0.0.${++ipSeq}`, ...over,
  };
  const [r] = await as("service", () =>
    q("select public.place_order($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'',$9) as o",
      [a.slug, a.name, a.phone, a.wilaya, a.commune, a.address, a.type, JSON.stringify(a.items), a.ip]));
  return r.o;
}
const code = (p) => p.then(() => "ok", (e) => e.code);

before(async () => {
  if (skip) return;
  db = new pg.Client({ connectionString: url });
  await db.connect();
  await db.query("truncate public.orders, public.products, public.shops, public.order_attempts, auth.users cascade");
  await db.query("insert into auth.users (id, email) values ($1,'a@test.dz'),($2,'b@test.dz')", [A, B]);
  [{ id: shopA }] = await q(
    "insert into public.shops (owner_id,name,slug,delivery_home_dzd,delivery_desk_dzd) values ($1,'TEST Shop','shop-a',600,400) returning id", [A]);
  [{ id: shopB }] = await q("insert into public.shops (owner_id,name,slug) values ($1,'Other','shop-b') returning id", [B]);
  [{ id: p1 }] = await q("insert into public.products (owner_id,shop_id,name,price_dzd) values ($1,$2,'Tapis',700) returning id", [A, shopA]);
  [{ id: p2 }] = await q("insert into public.products (owner_id,shop_id,name,price_dzd) values ($1,$2,'Coussin',250) returning id", [A, shopA]);
});
after(async () => db && db.end());

test("public order: DB prices, delivery fee, number, history, normalized phone", { skip }, async () => {
  const o = await placeOrder({ items: [{ product_id: p1, quantity: 1, unit_price_dzd: 1 }] });
  assert.match(o.number, /^BL-\d{6}$/);
  assert.equal(o.delivery_dzd, 400);
  assert.equal(o.total_dzd, 1100);
  const [row] = await q("select phone, status, history from public.orders where id=$1", [o.id]);
  assert.equal(row.phone, "0661234567");
  assert.equal(row.status, "new");
  assert.deepEqual(row.history.map((h) => h.status), ["new"]);
});

test("same order blocked for 10 minutes; different items allowed", { skip }, async () => {
  assert.equal(await code(placeOrder()), "P0409");
  const o = await placeOrder({ items: [{ product_id: p2, quantity: 2 }] });
  assert.equal(o.total_dzd, 900);
});

test("validation: phone, items from another shop, anon cannot call place_order", { skip }, async () => {
  assert.equal(await code(placeOrder({ phone: "0123" })), "22023");
  const [{ id: foreign }] = await q("insert into public.products (owner_id,shop_id,name,price_dzd) values ($1,$2,'X',10) returning id", [B, shopB]);
  assert.equal(await code(placeOrder({ items: [{ product_id: foreign, quantity: 1 }] })), "22023");
  assert.equal(await code(as("anon", () => q("select public.place_order('shop-a','Ali','0550000000','16','','','home','[]'::jsonb,'','')"))), "42501");
  assert.equal(await placeOrder({ phone: "+213 550 11 22 33" }).then((o) => o.number.length), 9);
});

test("rate limit per phone", { skip }, async () => {
  const phone = "0770000001";
  for (let i = 1; i <= 5; i++) await placeOrder({ phone, items: [{ product_id: p1, quantity: i }], ip: "" });
  assert.equal(await code(placeOrder({ phone, items: [{ product_id: p1, quantity: 9 }], ip: "" })), "P0429");
});

test("status flow writes history; invalid status 422; same status adds nothing", { skip }, async () => {
  const o = await placeOrder({ phone: "0550123456" });
  const set = (s, c, t) => as(A, () => q("select * from public.set_order_status($1,$2,$3,$4)", [o.id, s, c ?? null, t ?? null]));
  assert.equal(await code(set("pending")), "22023");
  await set("confirmed");
  await set("confirmed");
  const [shipped] = await set("shipped", "Yalidine", "YAL-778899");
  assert.equal(shipped.carrier, "Yalidine");
  assert.equal(shipped.tracking_number, "YAL-778899");
  const [done] = await set("delivered");
  assert.deepEqual(done.history.map((h) => h.status), ["new", "confirmed", "shipped", "delivered"]);
});

test("call results only on new orders; no_answer counts", { skip }, async () => {
  const o = await placeOrder({ phone: "0550999888" });
  const call = (r) => as(A, () => q("select * from public.record_call($1,$2)", [o.id, r]));
  await call("no_answer");
  const [r2] = await call("no_answer");
  assert.equal(r2.no_answer_count, 2);
  const [r3] = await call("confirmed");
  assert.equal(r3.status, "confirmed");
  assert.deepEqual(r3.history.map((h) => h.status), ["new", "no_answer", "no_answer", "confirmed"]);
  assert.equal(await code(call("no_answer")), "P0409");
  assert.equal(await code(call("bogus")), "22023");
});

test("seller cannot rewrite history or counters directly; edit never changes status", { skip }, async () => {
  const o = await placeOrder({ phone: "0550777666" });
  await as(A, () => q("update public.orders set history='[]', no_answer_count=9, customer_name='Karim B.' where id=$1", [o.id]));
  const [row] = await q("select history, no_answer_count, customer_name, status from public.orders where id=$1", [o.id]);
  assert.equal(row.history.length, 1);
  assert.equal(row.no_answer_count, 0);
  assert.equal(row.customer_name, "Karim B.");
  assert.equal(row.status, "new");
});

test("owner isolation: other seller sees nothing and gets not-found", { skip }, async () => {
  const o = await placeOrder({ phone: "0550444333" });
  const rows = await as(B, () => q("select id from public.orders_view where id=$1", [o.id]));
  assert.equal(rows.length, 0);
  assert.equal(await code(as(B, () => q("select * from public.set_order_status($1,'confirmed')", [o.id]))), "P0002");
  assert.equal(await code(as(B, () => q("select * from public.record_call($1,'confirmed')", [o.id]))), "P0002");
  const upd = await as(B, () => q("update public.orders set customer_name='hack' where id=$1 returning id", [o.id]));
  assert.equal(upd.length, 0);
  const anon = await as("anon", () => q("select count(*)::int n from public.orders").catch((e) => [{ n: e.code }]));
  assert.notEqual(anon[0].n > 0, true);
});

test("risk badge: 2+ returned/cancelled orders from the same phone", { skip }, async () => {
  const phone = "0660111222";
  for (const [i, s] of [[1, "cancelled"], [2, "returned"]]) {
    const o = await placeOrder({ phone, items: [{ product_id: p1, quantity: i }] });
    if (s === "returned") {
      await as(A, () => q("select public.set_order_status($1,'shipped')", [o.id]));
    }
    await as(A, () => q("select public.set_order_status($1,$2)", [o.id, s]));
  }
  const o = await placeOrder({ phone, items: [{ product_id: p2, quantity: 1 }] });
  const [row] = await as(A, () => q("select risk from public.orders_view where id=$1", [o.id]));
  assert.equal(row.risk, true);
  const [other] = await as(A, () => q("select risk from public.orders_view where phone='0661234567' limit 1"));
  assert.equal(other.risk, false);
});

test("tracking by number + phone only", { skip }, async () => {
  const o = await placeOrder({ phone: "0551000000" });
  const [ok] = await as("anon", () => q("select public.track_order($1,'+213551000000') t", [o.number.toLowerCase()]));
  assert.equal(ok.t.status, "new");
  assert.equal(ok.t.shop_name, "TEST Shop");
  const [bad] = await as("anon", () => q("select public.track_order($1,'0551000001') t", [o.number]));
  assert.equal(bad.t, null);
});

test("stats: Algeria-time week, rates, revenue from delivered only", { skip }, async () => {
  await db.query("truncate public.orders, public.order_attempts");
  const mk = async (phone, statuses) => {
    const o = await placeOrder({ phone, ip: "" });
    for (const s of statuses) await as(A, () => q("select public.set_order_status($1,$2)", [o.id, s]));
    return o;
  };
  await mk("0550000010", []);
  await mk("0550000011", ["confirmed", "shipped", "delivered"]);
  await mk("0550000012", ["confirmed", "shipped", "returned"]);
  await mk("0550000013", ["cancelled"]);
  const old = await mk("0550000014", ["cancelled"]);
  // one order created 1 minute before Monday 00:00 Algeria time: not "this week"
  // (the trigger protects created_at, so bypass it for this fixture)
  await db.query("set session_replication_role = replica");
  await db.query(
    `update public.orders set created_at = (date_trunc('week', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers') - interval '1 minute' where id=$1`,
    [old.id]);
  await db.query("set session_replication_role = origin");
  const [{ s }] = await as(A, () => q("select public.seller_stats() s"));
  assert.equal(s.week, 4);
  assert.equal(s.total, 5);
  assert.equal(s.confirmed, 2);
  assert.equal(s.shipped, 2);
  assert.equal(s.delivered, 1);
  assert.equal(s.returned, 1);
  assert.equal(s.revenue_dzd, 1100);
  const [{ s: sb }] = await as(B, () => q("select public.seller_stats() s"));
  assert.equal(sb.total, 0);
});

test("AI credits: signed-in only, capped per day", { skip }, async () => {
  assert.equal(await code(as("anon", () => q("select public.use_ai_credit(3)"))), "42501");
  const left = [];
  for (let i = 0; i < 3; i++) left.push((await as(A, () => q("select public.use_ai_credit(3) n")))[0].n);
  assert.deepEqual(left, [2, 1, 0]);
  assert.equal(await code(as(A, () => q("select public.use_ai_credit(3)"))), "P0429");
  const [{ n }] = await as(B, () => q("select public.use_ai_credit(3) n"));
  assert.equal(n, 2);
});

test("favourites: own rows only; product xor shop", { skip }, async () => {
  const [{ id: prod }] = await q("select id from public.products limit 1");
  await as(A, () => q("insert into public.favorites (product_id) values ($1)", [prod]));
  await as(A, () => q("insert into public.favorites (shop_id) values ($1)", [shopA]));
  assert.equal(await code(as(A, () => q("insert into public.favorites (product_id) values ($1)", [prod]))), "23505");
  assert.equal(await code(as(A, () => q("insert into public.favorites (product_id, shop_id) values ($1, $2)", [prod, shopA]))), "23514");
  const mine = await as(A, () => q("select public.my_favorites() f"));
  assert.equal(mine[0].f.products.length, 1);
  assert.equal(mine[0].f.shops.length, 1);
  const theirs = await as(B, () => q("select count(*)::int n from public.favorites"));
  assert.equal(theirs[0].n, 0);
  assert.equal(await code(as(B, () => q("insert into public.favorites (user_id, shop_id) values ($1, $2)", [A, shopA]))), "42501");
});
