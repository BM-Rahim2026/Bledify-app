"use client";
import { supabase } from "@/lib/supabase/client";

export const ADDRESS_LABELS = ["home", "work", "family", "other"] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];
export type Address = {
  id: string; label: AddressLabel; full_name: string; phone: string; wilaya: string; commune: string; address: string;
  is_default: boolean;
};
export type AddressDraft = Omit<Address, "id" | "is_default"> & { id?: string; is_default?: boolean };

export const emptyAddress = (p: Partial<AddressDraft> = {}): AddressDraft =>
  ({ label: "home", full_name: "", phone: "", wilaya: "", commune: "", address: "", ...p });

/** The signed-in person's addresses, default first. */
export async function listAddresses(): Promise<Address[]> {
  const { data } = await supabase().from("addresses")
    .select("id,label,full_name,phone,wilaya,commune,address,is_default")
    .order("is_default", { ascending: false }).order("updated_at", { ascending: false });
  return (data ?? []) as Address[];
}

/** Insert or update; returns the saved row, or an error code (TOO_MANY_ADDRESSES, …). */
export async function saveAddress(a: AddressDraft): Promise<{ row?: Address; error?: string }> {
  const { id, ...fields } = a;
  const q = id
    ? supabase().from("addresses").update(fields).eq("id", id)
    : supabase().from("addresses").insert(fields);
  const { data, error } = await q.select("id,label,full_name,phone,wilaya,commune,address,is_default").single();
  if (error) return { error: error.message.includes("TOO_MANY_ADDRESSES") ? "TOO_MANY_ADDRESSES" : "error" };
  return { row: data as Address };
}

export async function deleteAddress(id: string): Promise<boolean> {
  return !(await supabase().from("addresses").delete().eq("id", id)).error;
}

export async function makeDefault(id: string): Promise<boolean> {
  return !(await supabase().from("addresses").update({ is_default: true }).eq("id", id)).error;
}
