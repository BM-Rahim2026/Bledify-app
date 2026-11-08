"use client";
import { useEffect, useState } from "react";

// Cart kept in the browser, one entry per shop, so it survives the login step.
// Each shop's cart is ordered from that shop's page (each seller ships separately).
export type Cart = Record<string, number>;
const PREFIX = "bledify:cart:";
const key = (slug: string) => PREFIX + slug;
const EVENT = "bledify:cart";

function emit() {
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

export function readCart(slug: string): Cart {
  try { return JSON.parse(localStorage.getItem(key(slug)) || "{}") as Cart; } catch { return {}; }
}

export function writeCart(slug: string, cart: Cart) {
  try {
    const clean = Object.fromEntries(Object.entries(cart).filter(([, n]) => n > 0));
    if (Object.keys(clean).length) localStorage.setItem(key(slug), JSON.stringify(clean));
    else localStorage.removeItem(key(slug));
  } catch { /* storage unavailable */ }
  emit();
}

export function addToCart(slug: string, productId: string, n = 1) {
  const c = readCart(slug);
  c[productId] = Math.min(99, (c[productId] ?? 0) + n);
  writeCart(slug, c);
}

/** All carts: shop slug → { productId: qty }. */
export function readAllCarts(): Record<string, Cart> {
  const out: Record<string, Cart> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = readCart(k.slice(PREFIX.length));
    }
  } catch { /* ignore */ }
  return out;
}

export function cartCount(): number {
  return Object.values(readAllCarts()).reduce((n, c) => n + Object.values(c).reduce((a, b) => a + b, 0), 0);
}

/** Live number of items across all shops (for the cart badge). */
export function useCartCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const update = () => setN(cartCount());
    queueMicrotask(update);
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener("storage", update); };
  }, []);
  return n;
}
