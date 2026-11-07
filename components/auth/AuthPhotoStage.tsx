"use client";

// Auth desktop panel photo: a framed 2-card plate (season set front + mid — the same files as the landing hero,
// so coming from "/" they are already cached) on a soft season-tinted halo (.pn-auth-plate::before, --s-halo*).
// No glints / sparkles here (clip-art next to a form). Decorative (aria-hidden, alt=""); ONE "AI illustrations"
// chip on the front card labels the pair. 0 animations.
// Static HTML → cards are rendered without src and filled before first paint by the same picker as the hero.
// Seam: once AUTH_BLEED has a ≥ 1600×2400 photo for the season, this switches to a full-bleed photo + scrim.
import React, { useSyncExternalStore } from "react";
import { useSeason } from "@/lib/useSeason";
import { AUTH_BLEED, avifSrcSet, heroImage, heroPickerScript, heroSet, webpSrc } from "@/lib/heroImagery";
import { clusterLabel, imageLabel } from "@/lib/imageLabel";
import { useTr } from "@/lib/i18n/useTr";

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
// front = 1.5 × its ~340 px layout width (DPR 1 decodes the 640 file; see HERO_SIZES)
const SIZES = ["(min-width:1024px) 510px, 1px", "(min-width:1024px) 220px, 1px"];

export default function AuthPhotoStage() {
  const { locale } = useTr();
  const lang = locale === "vi" ? "vi" : "en";
  const season = useSeason();
  const mounted = useMounted();
  const set = heroSet(season);
  const label = clusterLabel("flow", lang);

  const bleed = mounted ? AUTH_BLEED[season] : undefined;
  const bleedImg = bleed ? heroImage(bleed) : undefined;
  if (bleedImg) {
    return (
      <div className="pn-auth-bleed" aria-hidden="true">
        <picture>
          <source type="image/avif" srcSet={bleedImg.widths.map((w) => `/hero/${bleedImg.file}-${w}.avif ${w}w`).join(", ")} sizes="42vw" />
          <img src={webpSrc(bleedImg)} alt="" width={bleedImg.w} height={bleedImg.h} />
        </picture>
        <span className="pn-img-label" data-chip="tr">{imageLabel("flow", lang)}</span>
      </div>
    );
  }

  const cards = [
    { im: set.front, cls: "pn-card--a" },
    { im: set.mid, cls: "pn-card--b" },
  ];
  return (
    <div className="pn-auth-stage" aria-hidden="true">
      <div className="pn-auth-plate">
        {cards.map(({ im, cls }, i) => (
          <figure key={cls} className={`pn-card ${cls}`} data-hero-slot={i} data-sizes={SIZES[i]}>
            <picture>
              <source type="image/avif" srcSet={mounted ? avifSrcSet(im) : undefined} sizes={mounted ? SIZES[i] : undefined} suppressHydrationWarning />
              <img width={800} height={1000} decoding="async" loading="lazy" src={mounted ? webpSrc(im) : undefined} sizes={mounted ? SIZES[i] : undefined} alt="" suppressHydrationWarning />
            </picture>
            {i === 0 && <span className="pn-img-label" data-chip={mounted ? im.chip : "bl"} suppressHydrationWarning>{label}</span>}
          </figure>
        ))}
      </div>
      <script dangerouslySetInnerHTML={{ __html: heroPickerScript(lang, false) }} />
    </div>
  );
}
