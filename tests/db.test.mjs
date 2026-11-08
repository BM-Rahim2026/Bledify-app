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
    q("select public.place_order($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'',$9,$10,$11) as o",
      [a.slug, a.name, a.phone, a.wilaya, a.commune, a.address, a.type, JSON.stringify(a.items), a.ip, a.customer ?? null, a.method ?? "cod"]));
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
    "insert into public.shops (owner_id,name,slug,delivery_home_dzd,delivery_desk_dzd,status) values ($1,'TEST Shop','shop-a',600,400,'approved') returning id", [A]);
  [{ id: shopB }] = await q("insert into public.shops (owner_id,name,slug,status) values ($1,'Other','shop-b','approved') returning id", [B]);
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
  await db.query("truncate public.orders, public.order_attempts cascade");
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

test("reviews: only the buyer, only after delivery, one per product (edit)", { skip }, async () => {
  const o = await placeOrder({ phone: "0550000300", ip: "" });
  await db.query("update public.orders set customer_id=$1 where id=$2", [B, o.id]);
  const review = (user, rating = 5, product = p1) =>
    as(user, () => q("select public.submit_review($1,$2,$3,'Très bien') r", [o.id, product, rating]));
  assert.equal(await code(review(B)), "P0409"); // not delivered yet
  for (const s of ["confirmed", "shipped", "delivered"]) await as(A, () => q("select public.set_order_status($1,$2)", [o.id, s]));
  assert.equal(await code(review(A)), "P0002"); // not the buyer
  assert.equal(await code(review("anon")), "42501");
  assert.equal(await code(review(B, 6)), "22023");
  assert.equal(await code(review(B, 5, p2)), "22023"); // not in this order
  await review(B, 3);
  await review(B, 4);
  const [{ n, rating, author }] = await q("select count(*)::int n, max(rating) rating, max(author) author from public.reviews where order_id=$1", [o.id]);
  assert.deepEqual([n, rating, author], [1, 4, "Karim T."]);
  const [{ p }] = await as("anon", () => q("select public.public_product($1) p", [p1]));
  assert.equal(p.review_count, 1);
  assert.equal(Number(p.rating), 4);
  assert.equal(p.reviews[0].comment, "Très bien");
  assert.equal(await code(as("anon", () => q("select * from public.reviews"))), "42501");
  const [{ m }] = await as(B, () => q("select public.my_orders() m"));
  assert.equal(m.find((x) => x.id === o.id).reviews[p1].rating, 4);
});

test("verified badge: the seller cannot set it, the team can", { skip }, async () => {
  await as(A, () => q("update public.shops set verified = true, name = 'TEST Shop' where id=$1", [shopA]));
  let [{ verified }] = await q("select verified from public.shops where id=$1", [shopA]);
  assert.equal(verified, false);
  await q("update public.shops set verified = true where id=$1", [shopA]);
  const [row] = await q("select verified, verified_at from public.shops where id=$1", [shopA]);
  assert.equal(row.verified, true);
  assert.ok(row.verified_at);
  await as(A, () => q("update public.shops set verified = false where id=$1", [shopA]));
  [{ verified }] = await q("select verified from public.shops where id=$1", [shopA]);
  assert.equal(verified, true);
});

test("delivery zones: fee by zone, closed zones refused, bad config rejected", { skip }, async () => {
  const zones = { local: { home: 300, desk: 200 }, nord: { home: 600, desk: 400 }, sud: { home: 1100, desk: 800, days_min: 3, days_max: 6 }, grand_sud: { off: true } };
  await as(A, () => q("update public.shops set wilaya='31 - Oran', delivery_zones=$2 where id=$1", [shopA, JSON.stringify(zones)]));
  assert.equal((await placeOrder({ phone: "0550000400", wilaya: "31 - Oran", ip: "" })).delivery_dzd, 200);
  assert.equal((await placeOrder({ phone: "0550000401", wilaya: "47 - Ghardaïa", type: "home", ip: "" })).delivery_dzd, 1100);
  assert.equal((await placeOrder({ phone: "0550000402", wilaya: "19 - Sétif", ip: "" })).delivery_dzd, 400); // hauts not set: flat fee
  assert.equal(await code(placeOrder({ phone: "0550000403", wilaya: "11 - Tamanrasset", ip: "" })), "22023");
  assert.equal(await code(as(A, () => q("update public.shops set delivery_zones='{\"mars\":{\"home\":1,\"desk\":1}}' where id=$1", [shopA]))), "23514");
  assert.equal(await code(as(A, () => q("update public.shops set delivery_zones='{\"nord\":{\"home\":\"x\",\"desk\":1}}' where id=$1", [shopA]))), "23514");
  await as(A, () => q("update public.shops set delivery_zones=null, wilaya='' where id=$1", [shopA]));
});

test("wilaya zones agree with src/lib/delivery.ts", { skip }, async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/lib/delivery.ts", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("ZONE_OF"), src.indexOf("};", src.indexOf("ZONE_OF")));
  const ts = Object.fromEntries([...block.matchAll(/(\d+): "(\w+)"/g)].map((m) => [Number(m[1]), m[2]]));
  const rows = await q("select n, public.wilaya_zone(lpad(n::text, 2, '0') || ' - X', '99 - Y') z from generate_series(1, 58) n");
  for (const { n, z } of rows) assert.equal(z, ts[n] ?? "nord", `wilaya ${n}`);
  const [{ z }] = await q("select public.wilaya_zone('31 - Oran', '31 - Oran') z");
  assert.equal(z, "local");
});

test("seller phone numbers stay private", { skip }, async () => {
  await q("update public.shops set phone='0770 11 22 33', whatsapp='0661998877' where id=$1", [shopA]);
  const pub = await as("anon", () => q(
    `select public.get_public_shop('shop-a')::text a, public.public_product($1)::text b, public.public_home()::text c,
            public.public_products()::text d, public.public_cart(array[$1]::uuid[])::text e`, [p1]));
  const all = Object.values(pub[0]).join(" ");
  assert.ok(!/0770|0661998877|whatsapp|"phone"/.test(all), "a public function leaks a seller number");
  assert.equal((await as("anon", () => q("select phone from public.shops"))).length, 0);
  const theirs = await as(B, () => q("select count(*)::int n from public.shops where id=$1", [shopA]));
  assert.equal(theirs[0].n, 0);
});

test("no phone numbers in public shop and product texts", { skip }, async () => {
  for (const txt of ["Appelez le 0661 23 45 67", "واتساب 0551-23-45-67", "+213 6 61 23 45 67", "contact: 00213661234567"]) {
    assert.equal(await code(as(A, () => q("update public.products set description=$2 where id=$1", [p1, txt]))), "22023", txt);
  }
  assert.equal(await code(as(A, () => q("update public.shops set description='Tel 0770112233' where id=$1", [shopA]))), "22023");
  assert.equal(await code(as(A, () => q("update public.products set story='WhatsApp 0661 234 567 merci' where id=$1", [p1]))), "22023");
  // ordinary numbers are fine
  await as(A, () => q("update public.products set description='Boîte de 30 pièces, 2500 DA, commande 48 h avant, 1 kg' where id=$1", [p1]));
  await as(A, () => q("update public.shops set description='Depuis 2015, 058 wilayas' where id=$1", [shopA]));
});


test("payments: card orders hidden until paid; deposits; allowed methods", { skip }, async () => {
  await db.query("truncate public.orders, public.order_attempts cascade");
  await q("update public.products set pay_cod=true, pay_card=true, deposit_pct=0 where shop_id=$1", [shopA]);
  // full card payment
  const card = await placeOrder({ phone: "0550000500", method: "card", ip: "" });
  assert.equal(card.payment_status, "pending");
  assert.equal(card.amount_online_dzd, card.total_dzd);
  assert.equal(card.amount_cod_dzd, 0);
  const seen = async () => (await as(A, () => q("select count(*)::int n from public.orders where id=$1", [card.id])))[0].n;
  assert.equal(await seen(), 0); // the shop does not see unpaid orders
  await as("service", () => q("select public.attach_checkout($1,'chk_1')", [card.id]));
  assert.equal(await code(as("service", () => q("select public.mark_order_paid('chk_1', 5)"))), "22023"); // wrong amount
  const [{ r }] = await as("service", () => q("select public.mark_order_paid('chk_1', $1) r", [card.total_dzd]));
  assert.equal(r.newly_paid, true);
  const [{ r: again }] = await as("service", () => q("select public.mark_order_paid('chk_1', $1) r", [card.total_dzd]));
  assert.equal(again.newly_paid, false); // idempotent
  assert.equal(await seen(), 1);
  // the shop cannot change payment fields
  await as(A, () => q("update public.orders set payment_status='none', amount_online_dzd=0 where id=$1", [card.id]));
  const [row] = await q("select payment_status, amount_online_dzd from public.orders where id=$1", [card.id]);
  assert.deepEqual([row.payment_status, row.amount_online_dzd], ["paid", card.total_dzd]);
  assert.equal(await code(as(A, () => q("update public.orders set delivery_dzd=0 where id=$1", [card.id]))), "22023");
  // deposit: 30 % of 700 = 210 DA online, the rest cash on delivery
  await q("update public.products set deposit_pct=30 where id=$1", [p1]);
  const dep = await placeOrder({ phone: "0550000501", ip: "" });
  assert.deepEqual([dep.payment_method, dep.amount_online_dzd, dep.amount_cod_dzd, dep.payment_status], ["cod", 210, dep.total_dzd - 210, "pending"]);
  // a product without cash on delivery refuses the cod method
  await q("update public.products set pay_cod=false, deposit_pct=0 where id=$1", [p2]);
  assert.equal(await code(placeOrder({ phone: "0550000502", items: [{ product_id: p2, quantity: 1 }], ip: "" })), "22023");
  await q("update public.products set pay_card=false, pay_cod=true where id=$1", [p2]);
  assert.equal(await code(placeOrder({ phone: "0550000503", items: [{ product_id: p2, quantity: 1 }], method: "card", ip: "" })), "22023");
  assert.equal(await code(q("update public.products set pay_cod=false, pay_card=false where id=$1", [p2])), "23514");
  await q("update public.products set pay_cod=true, pay_card=true, deposit_pct=0 where shop_id=$1", [shopA]);
  // unpaid orders expire
  await db.query("set session_replication_role = replica");
  await q("update public.orders set created_at = now() - interval '3 hours' where id=$1", [dep.id]);
  await db.query("set session_replication_role = origin");
  await placeOrder({ phone: "0550000504", ip: "" });
  const [exp] = await q("select status, payment_status from public.orders where id=$1", [dep.id]);
  assert.deepEqual([exp.status, exp.payment_status], ["cancelled", "failed"]);
});

test("payouts: commission, hold period, refunds, payouts", { skip }, async () => {
  await db.query("truncate public.orders, public.order_attempts, public.seller_ledger cascade");
  const o = await placeOrder({ phone: "0550000600", ip: "" }); // 700 + 400 delivery, cash on delivery
  for (const st of ["confirmed", "shipped", "delivered"]) await as(A, () => q("select public.set_order_status($1,$2)", [o.id, st]));
  const [row] = await q("select commission_dzd, seller_net_dzd from public.orders where id=$1", [o.id]);
  assert.deepEqual([row.commission_dzd, row.seller_net_dzd], [70, 1030]); // 10 % of the items only
  let [{ b }] = await as(A, () => q("select public.seller_balance() b"));
  assert.deepEqual([b.on_hold, b.available, b.paid_out], [1030, 0, 0]);
  const [{ n: other }] = await as(B, () => q("select count(*)::int n from public.seller_ledger"));
  assert.equal(other, 0);
  assert.equal(await code(as(A, () => q("insert into public.seller_ledger (shop_id, kind, amount_dzd) values ($1,'adjustment',99999)", [shopA]))), "42501");
  assert.equal(await code(as(A, () => q("select public.record_payout($1, 10, 'x')", [shopA]))), "42501");
  await q("update public.seller_ledger set available_at = now() - interval '1 minute' where order_id=$1", [o.id]);
  [{ b }] = await as(A, () => q("select public.seller_balance() b"));
  assert.equal(b.available, 1030);
  assert.equal(await code(as("service", () => q("select public.record_payout($1, 2000, 'CCP 1')", [shopA]))), "22023");
  await as("service", () => q("select public.record_payout($1, 1000, 'CCP virement 1')", [shopA]));
  [{ b }] = await as(A, () => q("select public.seller_balance() b"));
  assert.deepEqual([b.available, b.paid_out], [30, 1000]);
  // a paid card order cancelled by the shop must be refunded; the team may credit part of it to the shop
  const c = await placeOrder({ phone: "0550000601", method: "card", ip: "" });
  await as("service", () => q("select public.attach_checkout($1,'chk_2')", [c.id]));
  await as("service", () => q("select public.mark_order_paid('chk_2', $1)", [c.total_dzd]));
  await as(A, () => q("select public.record_call($1,'cancelled')", [c.id]));
  const [{ payment_status }] = await q("select payment_status from public.orders where id=$1", [c.id]);
  assert.equal(payment_status, "refund_due");
  await as("service", () => q("select public.resolve_refund($1, 200, 'acompte gardé')", [c.id]));
  [{ b }] = await as(A, () => q("select public.seller_balance() b"));
  assert.equal(b.available, 230);
});

test("subcategories: must belong to the category; filter; same list as src/lib/categories.ts", { skip }, async () => {
  await q("update public.products set category='food', subcategory='trad_cakes' where id=$1", [p1]);
  assert.equal(await code(q("update public.products set subcategory='rugs' where id=$1", [p1])), "23514");
  assert.equal(await code(q("update public.products set category='home' where id=$1", [p1])), "23514"); // trad_cakes is not a home subcategory
  const [{ r }] = await as("anon", () => q("select public.public_products(p_category=>'food', p_sub=>'trad_cakes') r"));
  assert.ok(r.some((x) => x.id === p1 && x.subcategory === "trad_cakes"));
  const [{ r: none }] = await as("anon", () => q("select public.public_products(p_category=>'food', p_sub=>'breads') r"));
  assert.ok(!none.some((x) => x.id === p1));
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/lib/categories.ts", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("SUBCATEGORIES: Record"), src.indexOf("};", src.indexOf("SUBCATEGORIES: Record")));
  for (const m of block.matchAll(/(\w+): \[([^\]]*)\]/g)) {
    const ts = [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1]);
    const [{ s }] = await q("select public.subcategories_of($1) s", [m[1]]);
    assert.deepEqual(s, ts, m[1]);
  }
  await q("update public.products set subcategory=null where id=$1", [p1]);
});

test("sellers by subcategory: shops with their matching products only", { skip }, async () => {
  await q("update public.products set category='food', subcategory='trad_cakes', active=true where id=$1", [p1]);
  await q("update public.products set category='food', subcategory='breads', active=true where id=$1", [p2]);
  const [{ r }] = await as("anon", () => q("select public.public_sellers('food','trad_cakes') r"));
  const mine = r.find((s) => s.slug === "shop-a");
  assert.ok(mine);
  assert.deepEqual(mine.products.map((p) => p.id), [p1]);
  assert.equal(mine.product_count, 1);
  assert.ok(!("phone" in mine) && !("whatsapp" in mine));
  const [{ r: none }] = await as("anon", () => q("select public.public_sellers('food','chocolate') r"));
  assert.ok(!none.some((s) => s.slug === "shop-a"));
  await q("update public.products set subcategory=null where id in ($1,$2)", [p1, p2]);
});

test("offers: shops propose, only the team approves; approved products appear on the offer", { skip }, async () => {
  const onOffer = async () => (await as("anon", () => q("select public.public_products(p_tag=>'ramadan') r")))[0].r.some((x) => x.id === p1);
  // shops cannot tag products themselves
  await as(A, () => q("update public.products set tags='{ramadan}' where id=$1", [p1]));
  assert.equal(await onOffer(), false);
  // a proposal is pending, whatever status the shop sends
  const [e] = await as(A, () => q("insert into public.offer_entries (offer_slug, product_id, shop_id, status) values ('ramadan',$1,$2,'approved') returning id, status", [p1, shopA]));
  assert.equal(e.status, "pending");
  assert.equal(await onOffer(), false);
  assert.equal(await code(as(A, () => q("update public.offer_entries set status='approved' where id=$1", [e.id]))), "42501");
  assert.equal(await code(as(B, () => q("insert into public.offer_entries (offer_slug, product_id, shop_id) values ('aid',$1,$2)", [p1, shopA]))), "42501");
  assert.equal(await code(as(A, () => q("select public.review_offer_entry($1, true)", [e.id]))), "42501");
  // the team approves
  await as("service", () => q("select public.review_offer_entry($1, true, 'ok')", [e.id]));
  assert.equal(await onOffer(), true);
  // closing the offer removes it from products; reopening brings it back
  await q("update public.offers set active=false where slug='ramadan'");
  assert.equal(await onOffer(), false);
  assert.equal(await code(as(A, () => q("insert into public.offer_entries (offer_slug, product_id, shop_id) values ('ramadan',$1,$2)", [p2, shopA]))), "22023");
  await q("update public.offers set active=true where slug='ramadan'");
  assert.equal(await onOffer(), true);
  // withdrawing removes it
  await as(A, () => q("delete from public.offer_entries where id=$1", [e.id]));
  assert.equal(await onOffer(), false);
});

test("admin: only the team can list, approve proposals and save offers", { skip }, async () => {
  const [e] = await as(A, () => q("insert into public.offer_entries (offer_slug, product_id, shop_id) values ('aid',$1,$2) returning id", [p1, shopA]));
  assert.equal(await code(as(A, () => q("select public.admin_offer_entries()"))), "42501");
  assert.equal(await code(as(A, () => q("select public.admin_review_offer_entry($1, true)", [e.id]))), "42501");
  assert.equal(await code(as("anon", () => q("select public.admin_offers()"))), "42501");
  const [{ a }] = await as(A, () => q("select public.is_admin() a"));
  assert.equal(a, false);
  await q("insert into public.admins (user_id) values ($1)", [B]);
  const [{ r }] = await as(B, () => q("select public.admin_offer_entries('pending') r"));
  const row = r.find((x) => x.id === Number(e.id));
  assert.equal(row.product.id, p1);
  assert.equal(row.shop.slug, "shop-a");
  await as(B, () => q("select public.admin_review_offer_entry($1, false, 'Photo floue')", [e.id]));
  const [st] = await q("select status, note from public.offer_entries where id=$1", [e.id]);
  assert.deepEqual([st.status, st.note], ["rejected", "Photo floue"]);
  await as(B, () => q(`select public.admin_save_offer('{"slug":"fete-meres","kind":"special","title_fr":"Fête des mères","title_ar":"عيد الأم","active":false}')`));
  const [{ o }] = await as(B, () => q("select public.admin_offers() o"));
  assert.ok(o.some((x) => x.slug === "fete-meres" && x.kind === "special" && x.active === false));
  assert.equal(await code(as(A, () => q("insert into public.admins (user_id) values ($1)", [A]))), "42501");
  await q("delete from public.offers where slug='fete-meres'");
  await q("delete from public.offer_entries where id=$1", [e.id]);
  await q("delete from public.admins");
});

test("admin by email: only once the address is confirmed", { skip }, async () => {
  const C = "00000000-0000-0000-0000-00000000000c";
  await q("insert into public.admin_emails (email) values ('team@test.dz') on conflict do nothing");
  await q("insert into auth.users (id, email) values ($1, 'Team@test.dz')", [C]);
  const isAdmin = async () => (await as(C, () => q("select public.is_admin() a")))[0].a;
  assert.equal(await isAdmin(), false); // not confirmed yet
  await q("update auth.users set email_confirmed_at = now() where id=$1", [C]);
  assert.equal(await isAdmin(), true);
  assert.equal(await code(as(C, () => q("insert into public.admin_emails (email) values ('x@y.dz')"))), "42501");
  await q("delete from auth.users where id=$1", [C]);
  await q("delete from public.admin_emails where email='team@test.dz'");
});

test("admin console: moderation and admin functions", { skip }, async () => {
  await q("update public.products set active=true, blocked=false, seller_active=true where shop_id=$1", [shopA]);
  await q("update public.shops set suspended=false where id=$1", [shopA]);
  // non-admins are refused everywhere
  for (const f of ["admin_dashboard()", "admin_shops()", "admin_products()", "admin_orders()", "admin_payouts()", "admin_reviews()", "admin_settings()"]) {
    assert.equal(await code(as(A, () => q(`select public.${f}`))), "42501", f);
  }
  // shops cannot set admin fields
  await as(A, () => q("update public.shops set suspended=true, commission_pct=0, is_demo=true where id=$1", [shopA]));
  const [sh] = await q("select suspended, commission_pct, is_demo from public.shops where id=$1", [shopA]);
  assert.deepEqual([sh.suspended, sh.commission_pct, sh.is_demo], [false, null, false]);
  await q("insert into public.admins (user_id) values ($1)", [B]);
  const visible = async (id) => (await as("anon", () => q("select public.public_product($1) p", [id])))[0].p !== null;
  // block a product: hidden, and the shop cannot bring it back
  await as(B, () => q("select public.admin_set_product_blocked($1, true, 'Produit importé')", [p1]));
  assert.equal(await visible(p1), false);
  await as(A, () => q("update public.products set active=true, blocked=false where id=$1", [p1]));
  assert.equal(await visible(p1), false);
  await as(B, () => q("select public.admin_set_product_blocked($1, false)", [p1]));
  assert.equal(await visible(p1), true);
  // suspend the shop: all its products disappear, then come back as the shop had them
  await as(A, () => q("update public.products set active=false where id=$1", [p2])); // the shop had hidden p2
  await as(B, () => q(`select public.admin_update_shop($1, '{"suspended":true,"suspended_reason":"KYC"}')`, [shopA]));
  assert.equal(await visible(p1), false);
  assert.equal(await code(placeOrder({ phone: "0550000700", ip: "" })), "22023");
  await as(B, () => q(`select public.admin_update_shop($1, '{"suspended":false,"verified":true,"commission_pct":"5"}')`, [shopA]));
  assert.equal(await visible(p1), true);
  assert.equal(await visible(p2), false); // stays as the shop wanted
  const [{ s }] = await as(B, () => q("select public.admin_shop($1) s", [shopA]));
  assert.deepEqual([s.verified, Number(s.commission_effective), s.suspended], [true, 5, false]);
  assert.ok("phone" in s && "payout_account" in s);
  await as(B, () => q(`select public.admin_update_shop($1, '{"commission_pct":""}')`, [shopA]));
  // lists, settings, admins
  const [{ d }] = await as(B, () => q("select public.admin_dashboard() d"));
  assert.ok(d.shops_total >= 2 && "refunds_due" in d);
  const [{ l }] = await as(B, () => q("select public.admin_shops('shop-a') l"));
  assert.equal(l.length, 1);
  await as(B, () => q(`select public.admin_save_settings('{"commission_pct":12}')`));
  const [{ st }] = await as(B, () => q("select public.admin_settings() st"));
  assert.equal(Number(st.commission_pct), 12);
  await as(B, () => q(`select public.admin_save_settings('{"commission_pct":10}')`));
  await as(B, () => q("select public.admin_add_admin_email(' New@Team.dz ')"));
  const [{ e }] = await q("select count(*)::int e from public.admin_emails where email='new@team.dz'");
  assert.equal(e, 1);
  assert.equal(await code(as(B, () => q("select public.admin_remove_admin_email('b@test.dz')"))), "22023"); // not themself
  await as(B, () => q("select public.admin_remove_admin_email('new@team.dz')"));
  await q("update public.shops set verified=false where id=$1", [shopA]);
  await q("update public.products set active=true, seller_active=true where shop_id=$1", [shopA]);
  await q("delete from public.admins");
});

test("seller applications: new shops wait for approval, hidden until then", { skip }, async () => {
  const D = "00000000-0000-0000-0000-00000000000d";
  await q("insert into auth.users (id, email) values ($1, 'd@test.dz')", [D]);
  const [{ id: shopD }] = await as(D, () => q("insert into public.shops (owner_id, name, slug, application_note, status) values ($1, 'Atelier D', 'atelier-d', 'Je fais du makrout', 'approved') returning id", [D]));
  const [s0] = await q("select status from public.shops where id=$1", [shopD]);
  assert.equal(s0.status, "pending"); // cannot approve itself
  const [{ id: pd }] = await as(D, () => q("insert into public.products (shop_id, name, price_dzd, active) values ($1, 'Makrout', 900, true) returning id", [shopD]));
  const pub = async () => (await as("anon", () => q("select public.public_product($1) p, public.get_public_shop('atelier-d') s", [pd])))[0];
  let r = await pub();
  assert.equal(r.p, null); assert.equal(r.s, null);
  await q("insert into public.admins (user_id) values ($1)", [B]);
  await as(B, () => q(`select public.admin_update_shop($1, '{"status":"rejected","review_note":"Photos manquantes"}')`, [shopD]));
  // the applicant updates the application: back to review
  await as(D, () => q("update public.shops set application_note='Je fais du makrout depuis 10 ans' where id=$1", [shopD]));
  const [s1] = await q("select status from public.shops where id=$1", [shopD]);
  assert.equal(s1.status, "pending");
  const [{ l }] = await as(B, () => q("select public.admin_shops('', 'pending') l"));
  assert.ok(l.some((x) => x.id === shopD));
  await as(B, () => q(`select public.admin_update_shop($1, '{"status":"approved"}')`, [shopD]));
  r = await pub();
  assert.ok(r.p && r.s);
  const [{ d }] = await as(B, () => q("select public.admin_dashboard() d"));
  assert.ok("applications" in d);
  await q("delete from public.admins");
  await q("delete from auth.users where id=$1", [D]);
});

test("admin v2: reports, disputes, blocked accounts, review queue, log, analytics", { skip }, async () => {
  await q("insert into public.admins (user_id) values ($1)", [B]);
  // a buyer reports a product (reason must fit the kind)
  const [{ rid }] = await as(A, () => q("select public.submit_report('product', $1, 'imported', 'Vient de Chine') rid", [p1]));
  assert.equal(await code(as(A, () => q("select public.submit_report('product', $1, 'damaged')", [p1]))), "22023");
  assert.equal(await code(as("anon", () => q("select public.submit_report('product', $1, 'scam')", [p1]))), "42501");
  // order disputes only by the buyer, once delivered/shipped
  const o = await placeOrder({ phone: "0550000900", ip: "" });
  await q("update public.orders set customer_id=$1 where id=$2", [A, o.id]);
  assert.equal(await code(as(A, () => q("select public.submit_report('order', $1, 'not_received')", [o.id]))), "P0409"); // still new
  for (const st of ["confirmed", "shipped"]) await as(A, () => q("select public.set_order_status($1,$2)", [o.id, st]));
  assert.equal(await code(as(B, () => q("select public.submit_report('order', $1, 'not_received')", [o.id]))), "P0002"); // not the buyer
  await as(A, () => q("select public.submit_report('order', $1, 'not_received', 'Rien reçu')", [o.id]));
  assert.equal(await code(as(A, () => q("select public.submit_report('order', $1, 'damaged')", [o.id]))), "P0409"); // already open
  const [{ r }] = await as(B, () => q("select public.admin_reports('open') r"));
  assert.ok(r.some((x) => x.id === Number(rid) && x.target.name === "Tapis"));
  await as(B, () => q("select public.admin_resolve_report($1, 'resolved', 'Produit masqué')", [rid]));
  const [{ mine }] = await as(A, () => q("select public.my_reports() mine"));
  assert.equal(mine.find((x) => x.id === Number(rid)).status, "resolved");
  // blocked accounts
  assert.equal(await code(as(A, () => q("select public.admin_set_user_blocked($1, true)", [B]))), "42501");
  await as(B, () => q("select public.admin_set_user_blocked($1, true, 'Commandes fictives')", [A]));
  const [{ m }] = await as(A, () => q("select public.my_block() m"));
  assert.equal(m.reason, "Commandes fictives");
  const [{ c }] = await as(B, () => q("select public.admin_customers('', 'blocked') c"));
  assert.ok(c.some((x) => x.id === A));
  await as(B, () => q("select public.admin_set_user_blocked($1, false)", [A]));
  // review queue: a product edited by an unverified shop needs a new check
  await q("update public.shops set verified=false, status='approved' where id=$1", [shopA]);
  await as(A, () => q("update public.products set description='Nouvelle description' where id=$1", [p1]));
  let [{ rq }] = await as(B, () => q("select public.admin_review_queue() rq"));
  assert.ok(rq.some((x) => x.id === p1));
  await as(B, () => q("select public.admin_mark_reviewed($1::uuid[])", [[p1]]));
  [{ rq }] = await as(B, () => q("select public.admin_review_queue() rq"));
  assert.ok(!rq.some((x) => x.id === p1));
  // the log records admin actions only
  const [{ log }] = await as(B, () => q("select public.admin_audit_log() log"));
  assert.ok(log.some((x) => x.target_type === "reports" && x.action === "resolved"));
  assert.ok(log.some((x) => x.target_type === "products" && x.target_id === p1));
  const before = log.length;
  await as(A, () => q("update public.products set description='Encore' where id=$1", [p1])); // a shop's own change
  const [{ log: log2 }] = await as(B, () => q("select public.admin_audit_log() log"));
  assert.equal(log2.length, before);
  // notes, search, analytics, counts
  await as(B, () => q("select public.admin_add_note('shop', $1, 'Appelée le 3 nov.')", [shopA]));
  const [{ n }] = await as(B, () => q("select public.admin_notes('shop', $1) n", [shopA]));
  assert.equal(n[0].body, "Appelée le 3 nov.");
  const [{ s }] = await as(B, () => q("select public.admin_search('TEST') s"));
  assert.ok(s.shops.some((x) => x.id === shopA));
  const [{ an }] = await as(B, () => q("select public.admin_analytics(30) an"));
  assert.equal(an.daily.length, 30);
  assert.ok("gmv" in an.current && "gmv" in an.previous && "no_photo" in an.catalog);
  const [{ cnt }] = await as(B, () => q("select public.admin_counts() cnt"));
  assert.ok("reports" in cnt && "review_queue" in cnt);
  assert.equal(await code(as(A, () => q("select public.admin_analytics(30)"))), "42501");
  await q("delete from public.admins");
  await q("update public.products set reviewed_at=now() where shop_id=$1", [shopA]);
});
