"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface RadarTrend { id: string; name: { vi: string; en: string }; source: { vi: string; en: string }; occasion: string | null; designs: { id: string; title: string; titleEn: string; imageUrl: string | null }[] }

/** "Xu hướng mẫu nail đang lên" (trang /trends): trend có nguồn + mẫu PawNail làm theo → trang riêng từng mẫu. */
export default function NailTrendRadar() {
  useTr(); // render lại khi đổi VI/EN
  const [trends, setTrends] = useState<RadarTrend[] | null>(null);
  useEffect(() => {
    fetch("/api/trends/nail-radar")
      .then((r) => (r.ok ? r.json() : { trends: [] }))
      .then((d) => setTrends(d.trends || []))
      .catch(() => setTrends([]));
  }, []);
  const shown = (trends ?? []).filter((t) => t.designs.length);
  if (!shown.length) return null;
  return (
    <section aria-label={tr("Xu hướng mẫu nail đang lên", "Rising nail trends")} className="space-y-3" data-testid="nail-trend-radar">
      <div className="px-1">
        <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-300"><TrendingUp className="h-4 w-4" /></span>
          {tr("Xu hướng mẫu nail đang lên", "Rising nail trends")}
        </h2>
        <p className="mt-1 text-xs text-slate-500">{tr("Theo báo cáo xu hướng (Pinterest Predicts 2026…) và mùa lễ — kèm mẫu PawNail làm theo, bấm xem vật tư & các bước", "From trend reports (Pinterest Predicts 2026…) and the season — with PawNail designs to match; tap for materials & steps")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((t) => (
          <article key={t.id} className="glass-card space-y-2.5 rounded-2xl p-4">
            <div>
              <h3 className="text-sm font-black text-white">{tr(t.name.vi, t.name.en)}</h3>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{tr(t.source.vi, t.source.en)}</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {t.designs.map((d) => (
                <Link key={d.id} href={`/designs/${d.id}`} aria-label={tr(d.title, d.titleEn || d.title)} className="block aspect-square overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10 hover:ring-pink-400/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cdnImage(d.imageUrl, 200)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
