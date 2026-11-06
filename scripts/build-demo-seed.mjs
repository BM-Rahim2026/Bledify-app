// Generates supabase/migrations/0003_demo_seed.sql from the demo catalogue below.
// Demo sellers use @demo.bledify.app emails and is_demo = true; remove them with:
//   delete from auth.users where email like '%@demo.bledify.app';
// (cascades to their shops, products and orders)
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const CDN = "https://cdn.openart.ai/openart-ai/production/2026-11/create-image/MhvcIzM5LOm6TNPRGEXK/";
const IMG = {
  kaftan: "0217939605398378b571bdff213a087fe7b071b496c86893eba4a_0_1793960558343_21e0643b.jpeg",
  karakou: "021793960540823ceb2efb7fea58c55155fc9fb92515dcdc22234_0_1793960558396_835b4da2.jpeg",
  robeKabyle: "021793960542708600f73c29fbe2d8b6aeb9e23538767e735880e_0_1793960548909_ab099cd7.jpeg",
  kachabia: "021793960543656b70b2a74477c2b606f823ac231da83295f8d32_0_1793960549636_17c0e5de.jpeg",
  huileCheveux: "0217939605457784b2f64bfb09d213dd2215030b1eaaf1fec487b_0_1793960551993_705fcd40.jpeg",
  hammam: "021793960546826f9cb936a41ab283113693068986f31c3d340f4_0_1793960553516_a814e494.jpeg",
  henne: "021793960550082023ef2751affb9822ae18449966cb6b97d98ca_0_1793960563629_fd04238a.jpeg",
  tapis: "02179396057078881fbe8801b4cfc8e3454077f6383f7cf53257b_0_1793960576846_2a835134.jpeg",
  poterie: "02179396057275849d9e4e345fff0a9cbe1dfa11f8e7ca050fccd_0_1793960579361_7c67d626.jpeg",
  plateau: "0217939605738647dca00f85baedac28bed28ae8d5f3a99ca4741_0_1793960579717_8ebe900c.jpeg",
  lanterne: "021793960574947e0fa5d59a7b50e9f748f37815b909e28e45f08_0_1793960580957_d50dafeb.jpeg",
  coussins: "0217939605758289aa9d0b0344e85196ac345634277259cf9e848_0_1793960582191_2297ec01.jpeg",
  couverture: "021793960578983e8a97f786c365ea5f8ca348976dbfcd2e6831a_0_1793960585565_18826e46.jpeg",
  panier: "0217939605800444883e653edd60bc78b7b920f959874d94011c5_0_1793960585513_a0e157c2.jpeg",
  robeFille: "021793960606859e8ad6f8fac80a9b78040141fa10ae51d984e04_0_1793960612900_cf0f315d.jpeg",
  baklawa: "0217939608137500d9bd7330cfa68208494cd13d7460bba44129c_0_1793960820963_66c1bb9b.jpeg",
  makrout: "02179396081593045c07e4ff35b1f55227084b3d76e9a80268f59_0_1793960823376_1b17e623.jpeg",
  kalbElLouz: "0217939608174126438f8a7da3edc67692fae0fdfd3f96133f49c_0_1793960824510_b68be396.jpeg",
  plateauAid: "021793960819676e04d4405dfa8354a322f6f89cfd01771a856f3_0_1793960826609_541e4e72.jpeg",
  couscous: "021793960820726c305af2c12e62e554ff5b6f08b2a8ff7e3b11f_0_1793960826891_fbd9b5e5.jpeg",
  msemen: "0217939608207887dca00f85baedac28bed28ae8d5f3a99843931_0_1793960828508_2611544f.jpeg",
  miel: "0217939608388640eb6750cc7dc4c5e11333efa00d940eed22f07_0_1793960845840_80d1feb1.jpeg",
  huileOlive: "0217939608397643cb8a93f7287826a4278aac7f0d089f936dfed_0_1793960846705_aac1fbc9.jpeg",
  dattes: "0217939608413567e031431b40d2024cf18919c414bfdfac99884_0_1793960849548_136855be.jpeg",
  crochet: "021793960842753df1fe1cc6cb558c8468775817e951d5d4cf8f5_0_1793960849111_c7ab75cb.jpeg",
  savons: "02179396084371381fbe8801b4cfc8e3454077f6383f7cf9e99eb_0_1793960849961_5da4772e.jpeg",
  bracelet: "02179396084470369d9f56ebaf8adc0cbe3483f4c0cffb810cec1_0_1793960852767_370f902d.jpeg",
};

// [category, name, price, image, description]
const SHOPS = [
  { slug: "delices-de-yasmina", name: "Les Délices de Yasmina", wilaya: "09 - Blida", phone: "0661000101", delivered: 64,
    description: "Gâteaux traditionnels faits maison pour l'Aïd, les mariages et les fiançailles. Commandez 48 h à l'avance.",
    products: [
      ["gateaux", "Baklawa aux amandes (boîte de 30)", 4500, "baklawa", "Pâte feuilletée faite main, amandes et miel pur. Idéale pour les fêtes."],
      ["gateaux", "Makrout au miel (1 kg)", 2800, "makrout", "Semoule fine, pâte de dattes maison, trempé dans le miel et parsemé de sésame."],
      ["gateaux", "Kalb el louz (plateau de 24 parts)", 2400, "kalbElLouz", "Recette algéroise : semoule, amandes et sirop à l'eau de fleur d'oranger."],
      ["gateaux", "Plateau de l'Aïd (60 pièces assorties)", 6500, "plateauAid", "Dziriettes, mchewek, griwech, ghribia et tcharek. Présentation sur plateau."],
    ] },
  { slug: "cuisine-de-mama-fatma", name: "La Cuisine de Mama Fatma", wilaya: "15 - Tizi Ouzou", phone: "0770000202", delivered: 41,
    description: "Couscous roulé à la main et galettes comme à la maison. Préparés chaque matin en Kabylie.",
    products: [
      ["cuisine", "Couscous roulé à la main (2 kg)", 1600, "couscous", "Couscous fin roulé à la main, séché au soleil. Sans conservateur."],
      ["cuisine", "Msemen faits maison (lot de 10)", 700, "msemen", "Feuilletés et dorés, livrés le jour même. Se congèlent très bien."],
    ] },
  { slug: "ferme-ait-ahmed", name: "Ferme Aït Ahmed", wilaya: "06 - Béjaïa", phone: "0550000303", delivered: 87,
    description: "Produits de notre ferme familiale : miel de montagne, huile d'olive et dattes sélectionnées.",
    products: [
      ["terroir", "Miel de montagne (1 kg)", 5500, "miel", "Miel toutes fleurs récolté dans nos ruches des montagnes de Kabylie."],
      ["terroir", "Huile d'olive vierge extra (1 L)", 1300, "huileOlive", "Première pression à froid, olives de notre oliveraie familiale."],
      ["terroir", "Dattes Deglet Nour (2 kg)", 2200, "dattes", "Dattes de Biskra choisies une à une, en branchettes."],
    ] },
  { slug: "atelier-nesrine-couture", name: "Atelier Nesrine Couture", wilaya: "16 - Alger", phone: "0661000404", delivered: 29,
    description: "Couture traditionnelle sur mesure depuis mon atelier à la maison. Karakou, caftan et robes kabyles.",
    products: [
      ["couture", "Karakou algérois brodé main", 45000, "karakou", "Velours bordeaux, broderie fetla au fil doré. Sur mesure, délai 3 semaines."],
      ["couture", "Caftan en velours brodé", 28000, "kaftan", "Velours vert émeraude et broderie dorée. Toutes tailles, sur mesure."],
      ["couture", "Robe kabyle traditionnelle", 9500, "robeKabyle", "Robe kabyle avec galons colorés cousus main. Choix des couleurs possible."],
      ["couture", "Kachabia en laine (homme)", 12000, "kachabia", "Kachabia chaude en laine, finitions à la main. Tailles M à XXL."],
    ] },
  { slug: "petits-points-de-sarah", name: "Les Petits Points de Sarah", wilaya: "25 - Constantine", phone: "0770000505", delivered: 33,
    description: "Maman de trois enfants, je tricote et je couds des vêtements doux pour bébés et fillettes.",
    products: [
      ["enfants", "Ensemble bébé au crochet", 3800, "crochet", "Couverture, chaussons et bonnet en coton doux. Cadeau de naissance idéal."],
      ["enfants", "Robe de fête fillette", 4200, "robeFille", "Tulle rose et fleurs brodées, de 2 à 8 ans. Cousue à la main."],
    ] },
  { slug: "dar-tlemcen-artisanat", name: "Dar Tlemcen Artisanat", wilaya: "13 - Tlemcen", phone: "0550000606", delivered: 22,
    description: "Tissage et broderie de Tlemcen, faits main par les femmes de notre famille.",
    products: [
      ["artisanat", "Tapis berbère tissé main (150 × 200)", 22000, "tapis", "Laine de mouton tissée sur métier traditionnel. Pièce unique."],
      ["artisanat", "Couverture tissée en laine", 8500, "couverture", "Laine naturelle, rayures et franges faites main."],
      ["artisanat", "Coussins brodés (lot de 2)", 3600, "coussins", "Broderie traditionnelle terracotta et indigo, housses lavables."],
      ["artisanat", "Panier en osier tressé", 2200, "panier", "Tressé à la main avec anses en cuir. Pour le linge ou le rangement."],
    ] },
  { slug: "artisans-de-constantine", name: "Les Artisans de Constantine", wilaya: "25 - Constantine", phone: "0661000707", delivered: 18,
    description: "Cuivre ciselé, argent et poterie : le savoir-faire des artisans de Constantine et de Kabylie.",
    products: [
      ["artisanat", "Plateau en cuivre ciselé", 7800, "plateau", "Ciselé à la main par un artisan de Constantine. Diamètre 50 cm."],
      ["artisanat", "Lanterne en cuivre ciselé", 4900, "lanterne", "Lanterne ajourée avec verres colorés, lumière étoilée."],
      ["artisanat", "Poterie kabyle peinte (lot de 3)", 3500, "poterie", "Cruche et deux bols en terre cuite, motifs peints à la main."],
      ["bijoux", "Bracelet kabyle en argent", 14000, "bracelet", "Argent émaillé et corail, travail traditionnel de Beni Yenni."],
    ] },
  { slug: "beaute-naturelle-amel", name: "Beauté Naturelle d'Amel", wilaya: "31 - Oran", phone: "0770000808", delivered: 52,
    description: "Savons et soins naturels préparés à la maison, sans produits chimiques.",
    products: [
      ["beaute", "Savons artisanaux (lot de 4)", 1600, "savons", "Saponification à froid : olive, lavande, miel et argile."],
      ["beaute", "Coffret hammam : savon noir & kessa", 1200, "hammam", "Savon noir à l'huile d'olive et gant kessa pour le hammam."],
      ["beaute", "Henné naturel (250 g)", 650, "henne", "Henné pur, tamisé finement. Pour les cheveux et les fêtes."],
      ["beaute", "Huile capillaire naturelle (50 ml)", 1400, "huileCheveux", "Mélange d'huiles végétales pour fortifier et nourrir les cheveux."],
    ] },
];

const FIRST = ["Amina", "Karim", "Sofiane", "Lynda", "Nadia", "Yacine", "Imane", "Rachid", "Meriem", "Walid", "Samira", "Bilal", "Houda", "Omar", "Sara", "Mehdi"];
const LAST = ["B.", "K.", "M.", "H.", "A.", "D.", "S.", "T."];

const uuid = (seed) => {
  const h = createHash("sha1").update("bledify-demo:" + seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

let sql = `-- Demo marketplace content (generated by scripts/build-demo-seed.mjs).
-- Remove before launch:  delete from auth.users where email like '%@demo.bledify.app';

`;
SHOPS.forEach((s, i) => {
  const uid = uuid("user:" + s.slug);
  const sid = uuid("shop:" + s.slug);
  sql += `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', ${q(uid)}, 'authenticated', 'authenticated',
  ${q(s.slug + "@demo.bledify.app")}, '', now(), '{"provider":"email","providers":["email"]}',
  '{"demo":true,"role":"seller","language":"fr"}', now() - interval '${120 - i * 9} days', now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.shops (id, owner_id, name, slug, description, phone, whatsapp, wilaya,
  delivery_home_dzd, delivery_desk_dzd, notify_new_orders, is_demo, cover_url)
values (${q(sid)}, ${q(uid)}, ${q(s.name)}, ${q(s.slug)}, ${q(s.description)}, ${q(s.phone)}, ${q(s.phone)},
  ${q(s.wilaya)}, ${500 + (i % 3) * 100}, ${350 + (i % 2) * 50}, false, true, ${q(CDN + IMG[s.products[0][3]])})
on conflict (slug) do nothing;

`;
  s.products.forEach(([cat, name, price, img, desc], j) => {
    sql += `insert into public.products (id, owner_id, shop_id, name, description, price_dzd, images, category, position, created_at)
values (${q(uuid("product:" + s.slug + ":" + j))}, ${q(uid)}, ${q(sid)}, ${q(name)}, ${q(desc)}, ${price},
  array[${q(CDN + IMG[img])}], ${q(cat)}, ${j}, now() - interval '${(i * 4 + j) * 13} hours')
on conflict (id) do nothing;
`;
  });
  // past delivered orders, so the shop shows a track record
  for (let k = 0; k < s.delivered; k++) {
    const [cat, name, price] = s.products[k % s.products.length];
    void cat;
    const phone = "0" + ["5", "6", "7"][k % 3] + String(10000000 + ((i * 7919 + k * 104729) % 89999999)).padStart(8, "0");
    const cust = `${FIRST[(i + k) % FIRST.length]} ${LAST[(k * 3 + i) % LAST.length]}`;
    sql += `insert into public.orders (id, number, owner_id, shop_id, customer_name, phone, wilaya, items, delivery_dzd, status, source, created_at)
values (${q(uuid("order:" + s.slug + ":" + k))}, ${q("BL-" + String(100000 + i * 1000 + k).slice(-6))}, ${q(uid)}, ${q(sid)}, ${q(cust)}, ${q(phone)},
  ${q(s.wilaya)}, ${q(JSON.stringify([{ product_id: uuid("product:" + s.slug + ":" + (k % s.products.length)), name, unit_price_dzd: price, quantity: 1 }]))}::jsonb,
  400, 'delivered', 'shop', now() - interval '${10 + k * 2} days')
on conflict (id) do nothing;
`;
  }
  sql += "\n";
});

writeFileSync("supabase/migrations/0003_demo_seed.sql", sql);
console.log("wrote supabase/migrations/0003_demo_seed.sql", SHOPS.length, "shops",
  SHOPS.reduce((a, s) => a + s.products.length, 0), "products");
