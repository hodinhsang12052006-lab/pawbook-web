"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, ArrowRight, Store } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { stateName } from "@/lib/stateNames";
import { timeAgo } from "@/lib/feedFormat";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface ViewStats {
  week: number;
  viewers: number;
  salons: number;
  topState: string | null;
  recentSalons: { id: string; name: string; avatarUrl: string | null; market: "US" | "AU"; city: string | null; state: string | null; at: string }[];
}

// "Ai đã xem hồ sơ bạn" — 7 ngày gần nhất, số liệu thật.
// compact (trang chủ): chỉ hiện khi đã có lượt xem. Đầy đủ (trang Tài khoản):
// luôn hiện, kèm gợi ý tăng lượt xem khi còn 0.
export default function ProfileViewsCard({ compact = false, role }: { compact?: boolean; role?: string }) {
  useTr(); // render lại khi đổi VI/EN
  const [stats, setStats] = useState<ViewStats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/profile/views")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setStats(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!stats || (compact && stats.viewers === 0)) return null;
  const isTech = role !== "OWNER";

  return (
    <section id="ai-da-xem" aria-label={tr("Ai đã xem hồ sơ bạn", "Who viewed your profile")} className="scroll-mt-24 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.08] via-slate-900/60 to-slate-900/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25">
          <Eye className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-sky-300">{tr("Ai đã xem hồ sơ bạn · 7 ngày", "Who viewed your profile · 7 days")}</p>
          {stats.viewers > 0 ? (
            <p className="mt-0.5 text-sm font-bold leading-snug text-white">
              {tr(`${stats.viewers} người đã xem hồ sơ bạn`, `${stats.viewers} ${stats.viewers === 1 ? "person" : "people"} viewed your profile`)}
              {isTech && stats.salons > 0 && <span className="text-sky-200">{tr(` · ${stats.salons} tiệm`, ` · ${stats.salons} ${stats.salons === 1 ? "salon" : "salons"}`)}</span>}
              {stats.topState && <span className="font-medium text-slate-400">{tr(` · nhiều nhất từ ${stats.topState}`, ` · mostly from ${stats.topState}`)}</span>}
            </p>
          ) : (
            <p className="mt-0.5 text-sm leading-snug text-slate-300">
              {isTech
                ? tr("Chưa có ai xem tuần này. Hồ sơ có 3+ ảnh mẫu móng đẹp được tiệm xem nhiều hơn hẳn.", "No views this week yet. Profiles with 3+ great work photos get far more salon views.")
                : tr("Chưa có ai xem tuần này. Thêm ảnh tiệm và chính sách chia turn để thợ chú ý hơn.", "No views this week yet. Add salon photos and your commission policy to get noticed.")}
            </p>
          )}
        </div>
      </div>

      {isTech && stats.recentSalons.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {stats.recentSalons.slice(0, compact ? 3 : 5).map((s) => (
            <li key={s.id}>
              <Link href={`/profile/${s.id}`} className="flex items-center gap-2.5 rounded-xl bg-slate-950/50 px-2.5 py-2 ring-1 ring-white/5 transition-colors hover:ring-sky-400/40">
                <Avatar src={s.avatarUrl} name={s.name} seed={s.id} className="h-8 w-8" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-xs font-bold text-white"><Store className="h-3 w-3 flex-shrink-0 text-sky-300" /> {s.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {[s.city, s.state ? stateName(s.market, s.state) || s.state : null].filter(Boolean).join(", ")} · {timeAgo(s.at)}
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isTech && stats.salons > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">{tr("Tiệm đã xem mà chưa nhắn? Bấm vào tiệm để xem tin đang tuyển và nhắn trước.", "A salon viewed but didn't message? Tap it to see their openings and reach out first.")}</p>
      )}
    </section>
  );
}
