"use client";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { OrderForm } from "@/components/OrderForm";

export default function NewOrder() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("new_order")} back="/seller/orders" />
      <div className="p-4"><OrderForm /></div>
    </>
  );
}
