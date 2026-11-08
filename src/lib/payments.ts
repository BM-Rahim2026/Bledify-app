// Same rules as place_order (SQL): what each order pays online and on delivery.
export type PayLine = { price_dzd: number; qty: number; pay_cod?: boolean; pay_card?: boolean; deposit_pct?: number };
export type PayMethod = "cod" | "card";

export function allowedMethods(lines: PayLine[]): { cod: boolean; card: boolean } {
  return { cod: lines.every((l) => l.pay_cod !== false), card: lines.every((l) => l.pay_card !== false) };
}

export function splitPayment(lines: PayLine[], fee: number, method: PayMethod): { online: number; cod: number; deposit: boolean } {
  const items = lines.reduce((s, l) => s + l.price_dzd * l.qty, 0);
  const total = items + fee;
  if (method === "card") return { online: total, cod: 0, deposit: false };
  const deposit = lines.reduce((s, l) => s + Math.ceil((l.price_dzd * l.qty * (l.deposit_pct ?? 0)) / 100), 0);
  if (deposit <= 0) return { online: 0, cod: total, deposit: false };
  const online = Math.min(Math.max(Math.ceil(deposit / 10) * 10, 100), total);
  return { online, cod: total - online, deposit: true };
}
