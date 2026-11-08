import { notFound } from "next/navigation";
import { paymentMode } from "@/lib/server/payments";
import { TestPayment } from "./TestPayment";

// Simulated payment page: only with PAYMENTS_FAKE=1 outside production (local tests, demos).
export default async function TestPayPage({ params }: PageProps<"/pay/test/[id]">) {
  if (paymentMode() !== "test") notFound();
  return <TestPayment orderId={(await params).id} />;
}
