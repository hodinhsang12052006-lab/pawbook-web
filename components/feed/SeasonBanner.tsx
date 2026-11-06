"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Trophy, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { AiBadge } from "@/components/designs/DesignViews";
import type { Studio } from "./StudioCards";
import { seasonArt } from "@/lib/seasonArt";
import { cdnImage } from "@/lib/cdnImage";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { dt } from "@/lib/i18n/dataEn";

// Băng-rôn "Chủ đề tuần" kiểu tạp chí (V2, chỉ trong app — trang khách "/" giữ thẻ cũ trong StudioCards).
// Ảnh thật mang màu (mẫu đã đăng trùng dịp, không thì tấm tay mẫu PawNail) + lớp tối đo sẵn để chữ ngà ≥ 4.5:1
// trên chỗ sáng nhất của ảnh. Đây là quầng sáng DUY NHẤT của màn hình (--shadow-pn-glow, lệch xuống, màu mùa).
type SeasonDesign = { id: string; imageUrl: string | null; provider?: string; rendered?: boolean };
const designCache = new Map<string, Promise<SeasonDesign | null>>();
function useSeasonDesign(occasion: string | undefined): SeasonDesign | null {
  const [d, setD] = useState<SeasonDesign | null>(null);
  useEffect(() => {
    if (!occasion) return;
    let alive = true;
    if (!designCache.has(occasion)) {
      designCache.set(
        occasion,
        fetch(`/api/designs?occasion=${encodeURIComponent(occasion)}&limit=1`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => (Array.isArray(j?.designs) && j.designs[0]?.imageUrl ? (j.designs[0] as SeasonDesign) : null))
          .catch(() => null)
      );
    }
    designCache.get(occasion)!.then((x) => alive && setD(x));
    return () => {
      alive = false;
    };
  }, [occasion]);
  return d;
}

export default function SeasonBanner({
  studio,
  isOwner,
  market,
  onJoin,
  onHide,
  ref,
}: {
  studio: Studio;
  isOwner: boolean;
  market: "US" | "AU";
  onJoin: (hashtag: string) => void;
  onHide: () => void;
  ref?: React.Ref<HTMLElement>;
}) {
  useTr(); // render lại khi đổi VI/EN
  const t = studio.theme!;
  const c = studio.challenge;
  const art = seasonArt(t.id, market);
  const design = useSeasonDesign(t.id);
  const [loaded, setLoaded] = useState(false);
  const src = design?.imageUrl ? cdnImage(design.imageUrl, 720) : art.image;
  const dots = [t.colors[0], art.dot2 ?? t.colors[1], art.accent];

  return (
    <section
      ref={ref}
      aria-label={tr(`Chủ đề tuần: ${t.title}`, `Theme of the week: ${dt(t.title)}`)}
      className="pn-season relative overflow-hidden rounded-[24px] border border-pn-line bg-pn-surface"
      style={{ ["--season" as string]: art.accent, ["--season-ink" as string]: art.ink, ["--pn-glow" as string]: art.accent }}
    >
      <div className="pn-season-media relative overflow-hidden bg-pn-raised">
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) calc(100vw - 32px), 640px"
          onLoad={() => setLoaded(true)}
          className={`object-cover ${loaded ? "pn-loaded" : ""}`}
          style={{ objectPosition: design?.imageUrl ? "50% 50%" : art.position }}
        />
        <div aria-hidden className="pn-season-scrim absolute inset-0" />
        <AiBadge d={design ?? undefined} className="pn-season-chip absolute left-3 top-3" />
        <button
          type="button"
          onClick={onHide}
          aria-label={tr("Ẩn chủ đề hôm nay", "Hide today's theme")}
          className="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-full"
        >
          <span className="pn-season-chip flex h-9 w-9 items-center justify-center rounded-full text-white/90">
            <X className="h-[18px] w-[18px]" />
          </span>
        </button>
        <div className="absolute inset-x-5 bottom-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold leading-[18px] text-[#f6f0f5]/90">
            <span className="min-w-0 truncate">PawNail Studio · {tr("Chủ đề tuần này", "This week's theme")}</span>
            <span aria-hidden className="flex flex-shrink-0 items-center gap-1">
              {dots.map((col, i) => (
                <span key={i} className="h-2 w-2 rounded-full ring-1 ring-white/25" style={{ background: col }} />
              ))}
            </span>
          </p>
          <h3 className="mt-1 text-[24px] font-semibold leading-[30px] tracking-[-0.015em] text-[#f6f0f5]">{dt(t.title)}</h3>
        </div>
      </div>

      <div className="px-5 pb-4 pt-3.5">
        <p className="line-clamp-2 text-[15px] leading-[22px] text-pn-text-2">{dt(isOwner ? t.ownerTip : t.blurb)}</p>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {t.ideas.map((idea, i) => (
            <span key={idea} className="pn-season-idea flex h-8 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold text-pn-text">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: i % 2 ? art.dot2 ?? t.colors[1] : t.colors[0] }} />
              {dt(idea)}
            </span>
          ))}
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onJoin(t.hashtag)}
            className="pn-btn-inverted inline-flex h-11 flex-shrink-0 items-center gap-1.5 rounded-[14px] px-4 text-[15px] font-semibold"
          >
            <Trophy className="h-[18px] w-[18px]" />{tr(" Tham gia #", " Join #")}{t.hashtag}
          </button>
          {c && c.posts > 0 && (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex -space-x-2">
                {c.entries.map((e) => (
                  <span key={e.id} className="rounded-full ring-2 ring-pn-surface">
                    <Avatar src={e.author.avatarUrl} name={e.author.name} seed={e.author.id} className="h-6 w-6" />
                  </span>
                ))}
              </div>
              <span className="truncate text-[13px] text-pn-text-2">{c.posts}{tr(" bài đã tham gia", " entries so far")}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
