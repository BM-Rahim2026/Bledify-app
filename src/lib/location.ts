"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LOC_COOKIE, formatLoc, nearestWilaya, parseLoc, type Loc } from "@/lib/geo";

const EVENT = "bledify:loc";
const read = () => (typeof document === "undefined" ? "" : (document.cookie.match(/(?:^|; )loc=([^;]*)/)?.[1] ?? ""));
const subscribe = (cb: () => void) => { window.addEventListener(EVENT, cb); return () => window.removeEventListener(EVENT, cb); };

export function saveLoc(l: Loc) {
  document.cookie = `${LOC_COOKIE}=${formatLoc(l)}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(EVENT));
}

/** Browser GPS → nearest wilaya. Rejects when refused or unavailable. */
export function locateByGps(): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject(new Error("unavailable")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(nearestWilaya(p.coords.latitude, p.coords.longitude)),
      reject,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

/** Current location (shared by every component) and a setter that refreshes server-rendered sections. */
export function useLocation() {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const router = useRouter();
  const loc = parseLoc(raw);
  const set = useCallback((l: Loc) => { saveLoc(l); router.refresh(); }, [router]);
  return { loc, set };
}
