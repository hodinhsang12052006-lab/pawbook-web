"use client";

// /auth/register without ?role: "How will you use PawNail?" — one grouped list (client, technician, owner),
// social sign-up below an "or" rule, then the log-in link. On phones a 3-photo strip from the season's hero
// set (AI illustrations, decorative) sits under the subtitle; on desktop the brand panel carries the photos.
// No stat grid, no numbered "how it works", no FAQ here (the FAQ lives on the landing), no emoji.
import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronRight, Hand, Paintbrush, Store } from "lucide-react";
import SocialLogin from "@/components/auth/SocialLogin";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { tr } from "@/lib/i18n/tr";
import { useSeason } from "@/lib/useSeason";
import { avifSrcSet, heroPickerScript, heroSet, webpSrc } from "@/lib/heroImagery";
import { useTr } from "@/lib/i18n/useTr";

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
// Phones only (the strip is display:none ≥ 1024, so desktop never downloads it): ~31vw tiles.
const STRIP_SIZES = "(min-width:1024px) 1px, 31vw";

export type Role = "technician" | "owner" | "client" | null;

export default function RolePicker({ onPick }: { onPick: (role: Exclude<Role, null>) => void }) {
  const { t } = useLanguage();
  const { locale } = useTr();
  const set = heroSet(useSeason());
  const mounted = useMounted();
  const rows = [
    { role: "client" as const, icon: Hand, title: t("auth.rolePicker.clientTitle"), desc: t("auth.rolePicker.clientDesc") },
    { role: "technician" as const, icon: Paintbrush, title: t("auth.rolePicker.technicianTitle"), desc: t("auth.rolePicker.technicianDesc") },
    { role: "owner" as const, icon: Store, title: t("auth.rolePicker.ownerTitle"), desc: t("auth.rolePicker.ownerDesc") },
  ];
  return (
    <div data-role-picker>
      <h1 className="pn-display pn-h1">{t("auth.rolePicker.title")}</h1>
      <p className="pn-sub">{t("auth.rolePicker.subtitle")}</p>

      {/* Static HTML: tiles render without src and the inline picker fills the season's set before first paint
          (same picker as the landing hero) — no base-set download followed by a visible swap after hydration. */}
      <div className="pn-strip3" aria-hidden="true">
        {[set.front, set.mid, set.back].map((im, i) => (
          <div key={i} data-hero-slot={i} data-sizes={STRIP_SIZES}>
            <picture>
              <source type="image/avif" srcSet={mounted ? avifSrcSet(im) : undefined} sizes={mounted ? STRIP_SIZES : undefined} suppressHydrationWarning />
              <img src={mounted ? webpSrc(im) : undefined} sizes={mounted ? STRIP_SIZES : undefined} alt="" width={480} height={600} decoding="async" suppressHydrationWarning />
            </picture>
          </div>
        ))}
      </div>
      <script dangerouslySetInnerHTML={{ __html: heroPickerScript(locale === "vi" ? "vi" : "en", false) }} />
      <p className="pn-strip3-cap" aria-hidden="true">{tr("Ảnh minh hoạ AI", "AI illustrations")}</p>

      <div className="pn-list" style={{ marginTop: 24 }} role="list">
        {rows.map(({ role, icon: Icon, title, desc }) => (
          <button key={role} type="button" role="listitem" className="pn-row" onClick={() => onPick(role)} data-role={role}>
            <span className="pn-row-icon" aria-hidden><Icon strokeWidth={1.75} /></span>
            <span className="min-w-0">
              <span className="pn-row-title">{title}</span>
              <span className="pn-row-desc">{desc}</span>
            </span>
            <ChevronRight className="pn-row-chev" aria-hidden />
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <SocialLogin divider={false} lead={tr("hoặc", "or")} />
      </div>

      <p className="pn-muted pn-center" style={{ marginTop: 24 }}>
        {t("auth.rolePicker.haveAccount")}{" "}
        <Link href="/auth/login" className="pn-a">{t("auth.rolePicker.login")}</Link>
      </p>
    </div>
  );
}
