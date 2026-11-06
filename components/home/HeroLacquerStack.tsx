"use client";

// Landing hero photo stage: ≥ 1024 px a 3-card "lacquer" stack in 3D (front / mid / back) with a pink halo,
// a one-time gloss sweep and the season layer behind it; < 1024 px a scroll-snap strip of 5 cards (4:5).
// Photos = the season's hero set (lib/heroImagery.ts, Google Flow AI illustrations — always labelled).
//
// "/" is static HTML and only the browser knows the viewer's market / season, so the cards are server-rendered
// WITHOUT src/srcset (nothing downloads for the wrong season) and the inline picker right after them fills
// them in before first paint from html[data-season]. After mount React renders the same attributes from
// useSeason(), and a later season change (market toggle, IP lookup) swaps the set in place.
import React, { useEffect, useRef, useSyncExternalStore } from "react";
import SeasonLayer from "@/components/season/SeasonLayer";
import { useSeason } from "@/lib/useSeason";
import { CHIP_FIX, HERO_SLOTS, avifSrcSet, fixChip, heroPickerScript, heroSet, slotSizes, webpSrc } from "@/lib/heroImagery";
import { imageLabel } from "@/lib/imageLabel";
import { useTr } from "@/lib/i18n/useTr";

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

export default function HeroLacquerStack() {
  const { locale } = useTr();
  const lang = locale === "vi" ? "vi" : "en";
  const season = useSeason();
  const mounted = useMounted();
  const set = heroSet(season);
  const base = heroSet("base");
  const stageRef = useRef<HTMLDivElement>(null);

  // Season loops pause while the hero is off-screen or the tab is hidden (≤ 0.5 KB).
  useEffect(() => {
    const stage = stageRef.current;
    const layer = stage?.querySelector<HTMLElement>(".pn-season");
    if (!stage || !layer) return;
    let visible = true;
    const sync = () => layer.toggleAttribute("data-off", !visible || document.hidden);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
    io.observe(stage);
    document.addEventListener("visibilitychange", sync);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);

  const label = imageLabel("flow", lang);
  return (
    <div className="pn-stage" ref={stageRef}>
      <SeasonLayer variant="hero" />
      <div className="pn-stack" data-hero-photos>
        {HERO_SLOTS.map((slot, i) => {
          const im = set[slot];
          const sizes = slotSizes(slot);
          return (
            <figure key={slot} className={`pn-card pn-card--${slot}`} data-hero-slot={i} data-sizes={sizes} data-chip-fix={CHIP_FIX[slot]}>
              <picture>
                <source type="image/avif" srcSet={mounted ? avifSrcSet(im) : undefined} sizes={mounted ? sizes : undefined} suppressHydrationWarning />
                {/* eslint-disable-next-line @next/next/no-img-element -- art-directed AVIF set picked before first paint */}
                <img
                  width={800}
                  height={1000}
                  decoding="async"
                  loading={slot === "front" ? "eager" : "lazy"}
                  fetchPriority={slot === "front" ? "high" : undefined}
                  src={mounted ? webpSrc(im) : undefined}
                  sizes={mounted ? sizes : undefined}
                  alt={mounted ? `${im.alt[lang]} — ${lang === "vi" ? "ảnh minh hoạ AI" : "AI illustration"}` : ""}
                  suppressHydrationWarning
                />
              </picture>
              <span className="pn-img-label" data-chip={mounted ? fixChip(im.chip, CHIP_FIX[slot]) : "bl"} suppressHydrationWarning>{label}</span>
            </figure>
          );
        })}
      </div>
      <script dangerouslySetInnerHTML={{ __html: heroPickerScript(lang) }} />
      <noscript>
        <div className="pn-stack">
          {HERO_SLOTS.map((slot) => {
            const im = base[slot];
            return (
              <figure key={slot} className={`pn-card pn-card--${slot}`}>
                <picture>
                  <source type="image/avif" srcSet={avifSrcSet(im)} sizes={slotSizes(slot)} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img width={800} height={1000} src={webpSrc(im)} alt={`${im.alt[lang]} — ${lang === "vi" ? "ảnh minh hoạ AI" : "AI illustration"}`} />
                </picture>
                <span className="pn-img-label" data-chip={fixChip(im.chip, CHIP_FIX[slot])}>{label}</span>
              </figure>
            );
          })}
        </div>
      </noscript>
    </div>
  );
}
