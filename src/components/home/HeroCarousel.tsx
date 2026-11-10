"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { HERO_SLIDES } from "@/lib/categories";
import { Icon } from "@/components/Icon";
import type { DictKey } from "@/lib/i18n/dict";

/** A slide already in the reader's language (from the team's banners). */
export type HeroSlide = { key: string; image: string; title: string; sub: string; href: string };

// next/image only optimises known hosts; other links are shown as they are.
const optimisable = (src: string) => /^\/|^https:\/\/([a-z0-9-]+\.supabase\.co|cdn\.openart\.ai)\//.test(src);

/** Swipeable hero (scroll-snap) with dots and gentle auto-advance. Uses the team's banners, else the default slides. */
export function HeroCarousel({ banners = [] }: { banners?: HeroSlide[] }) {
  const { t } = useI18n();
  const slides: HeroSlide[] = banners.length ? banners
    : HERO_SLIDES.map((s) => ({ key: s.image, image: s.image, title: t(s.title as DictKey), sub: t(s.sub as DictKey), href: s.href }));
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setI(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    const timer = setInterval(() => {
      if (paused.current || document.hidden) return;
      const next = (Math.round(Math.abs(el.scrollLeft) / el.clientWidth) + 1) % Math.max(el.children.length, 1);
      const dir = getComputedStyle(el).direction === "rtl" ? -1 : 1;
      el.scrollTo({ left: dir * next * el.clientWidth, behavior: "smooth" });
    }, 6000);
    return () => { el.removeEventListener("scroll", onScroll); clearInterval(timer); };
  }, []);

  const go = (k: number) => {
    const el = ref.current;
    if (!el) return;
    const dir = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    el.scrollTo({ left: dir * k * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section className="relative" onPointerDown={() => (paused.current = true)}>
      <div ref={ref} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-b-[2rem] md:rounded-[2rem]">
        {slides.map((s, k) => (
          <div key={s.key} className="relative h-[360px] w-full shrink-0 snap-start md:h-[440px]">
            <Image src={s.image} alt="" fill priority={k === 0} unoptimized={!optimisable(s.image)} sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/70 md:bg-gradient-to-r md:from-black/60 md:via-black/30 md:to-transparent rtl:md:bg-gradient-to-l" />
            <div className="absolute inset-x-0 bottom-0 p-5 pb-10 md:inset-y-0 md:flex md:max-w-xl md:flex-col md:justify-center md:p-12">
              <h1 className="font-display text-[1.9rem] leading-tight text-white drop-shadow md:text-5xl">{s.title}</h1>
              {s.sub ? <p className="mt-2 max-w-md text-[15px] text-white/90 md:text-lg">{s.sub}</p> : null}
              <Link href={s.href} className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20 hover:bg-brand-dark">
                {t("shop_now")} <Icon name="arrow" className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {slides.length > 1 ? slides.map((s, k) => (
          <button key={s.key} type="button" aria-label={`${k + 1}`} onClick={() => go(k)}
            className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-2 bg-white/60"}`} />
        )) : null}
      </div>
    </section>
  );
}
