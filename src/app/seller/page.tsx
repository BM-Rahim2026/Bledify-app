"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { shopUrl, useSeller } from "@/lib/seller";
import { Button, Card } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";

type Stats = { by_status: Record<string, number>; revenue_month_dzd: number; week: number };

export default function Dashboard() {
  const { t, formatDZD } = useI18n();
  const { shop } = useSeller();
  const [s, setS] = useState<Stats | null>(null);
  const [products, setProducts] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const link = shopUrl(shop.slug);

  useEffect(() => {
    supabase().rpc("seller_stats").then(({ data }) => setS(data as Stats));
    supabase().from("products").select("id", { count: "exact", head: true }).then(({ count }) => setProducts(count ?? 0));
  }, []);

  const n = (k: string) => s?.by_status?.[k] ?? 0;
  const tiles = [
    { label: t("to_confirm"), value: n("new") + n("pending"), href: "/seller/orders?status=new" },
    { label: t("to_ship"), value: n("confirmed") + n("ready"), href: "/seller/orders?status=confirmed" },
    { label: t("in_transit"), value: n("shipped"), href: "/seller/orders?status=shipped" },
    { label: t("revenue_month"), value: formatDZD(s?.revenue_month_dzd ?? 0), href: "/seller/stats" },
  ];

  return (
    <>
      <PageHeader title={shop.name} />
      <div className="space-y-4 p-4">
        <Card className="bg-brand text-white border-brand">
          <p className="text-sm opacity-90">{t("your_link")}</p>
          <p className="mt-1 break-all font-semibold" dir="ltr">{link}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={async () => {
              await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500);
            }}>{copied ? t("copied") : t("copy")}</Button>
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-xl px-3 text-sm font-semibold text-white underline">{t("open_shop")}</a>
          </div>
          <p className="mt-2 text-xs opacity-90">{t("share_hint")}</p>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((x) => (
            <Link key={x.label} href={x.href}>
              <Card className="h-full">
                <p className="text-sm text-muted">{x.label}</p>
                <p className="mt-1 text-2xl font-bold">{s ? x.value : "…"}</p>
              </Card>
            </Link>
          ))}
        </div>
        {products === 0 ? (
          <Link href="/seller/products?new=1" className="block rounded-2xl border-2 border-dashed border-brand p-4 text-center font-semibold text-brand">
            + {t("add_first_product")}
          </Link>
        ) : null}
        <Link href="/seller/orders" className="block rounded-xl bg-ink px-4 py-3 text-center font-semibold text-white">{t("see_orders")}</Link>
      </div>
    </>
  );
}
