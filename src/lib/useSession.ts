"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { isConfigured } from "@/lib/env";

/** Current user (undefined while loading, null when signed out). */
export function useSession() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    if (!isConfigured) { queueMicrotask(() => setUser(null)); return; }
    const sb = supabase();
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return user;
}

export const displayName = (u: User | null | undefined) =>
  (u?.user_metadata?.full_name as string | undefined)?.split(" ")[0] || u?.email?.split("@")[0] || "";
