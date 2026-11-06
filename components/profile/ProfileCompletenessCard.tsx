"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Trophy } from "lucide-react";
import type { Completeness } from "@/lib/profileCompleteness";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// Vòng tiến độ + việc tiếp theo. `compact` dùng trong Sidebar/banner (chỉ
// hiện việc kế tiếp), bản đầy đủ dùng ở /profile (hiện cả checklist).
export default function ProfileCompletenessCard({
  completeness,
  compact = false,
  role,
}: {
  completeness: Completeness;
  compact?: boolean;
  role?: string;
}) {
  useTr(); // render lại khi đổi VI/EN
  const { percent, items, nextItem } = completeness;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const done = percent >= 100;
  const benefit =
    role === "OWNER"
      ? tr("Hồ sơ tiệm đầy đủ giúp thợ tin tưởng và gọi nhiều hơn.", "A complete salon profile earns more trust and calls from techs.")
      : tr("Hồ sơ đầy đủ được chủ tiệm chú ý và nhắn tin nhiều hơn.", "Complete profiles get noticed and messaged more by salons.");

  // Trang chủ / thanh bên (compact, V2): 1 hàng 56px — vòng tiến độ 32px, tiêu đề, "Tiếp theo: …". Cả hàng bấm được.
  if (compact && !done && nextItem) {
    const r = 13;
    const c = 2 * Math.PI * r;
    return (
      <Link href="/profile" className="glass-card flex min-h-14 items-center gap-3 rounded-2xl py-2 pl-3 pr-12 transition-colors duration-[120ms] active:bg-pn-raised">
        <span className="relative h-8 w-8 flex-shrink-0" role="img" aria-label={tr(`Hồ sơ hoàn thiện ${percent}%`, `Profile ${percent}% complete`)}>
          <svg viewBox="0 0 32 32" className="h-8 w-8 -rotate-90">
            <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,240,246,0.1)" strokeWidth="3" />
            <circle cx="16" cy="16" r={r} fill="none" stroke="#db2777" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} />
          </svg>
          <span className="pn-micro absolute inset-0 flex items-center justify-center text-[10px] text-pn-text tabular-nums">{percent}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-5 text-pn-text">{tr("Hoàn thiện hồ sơ", "Complete your profile")}</span>
          <span className="block truncate text-[13px] leading-[18px] text-pn-text-2">{tr("Tiếp theo: ", "Next: ")}{nextItem.label}</span>
        </span>
      </Link>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 flex-shrink-0" role="img" aria-label={tr(`Hồ sơ hoàn thiện ${percent}%`, `Profile ${percent}% complete`)}>
          <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
            <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke="#db2777"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percent / 100)}
              className="transition-[stroke-dashoffset] duration-700"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">{percent}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white flex items-center gap-1.5">
            {done ? <><Trophy className="h-4 w-4 text-amber-400" />{tr(" Hồ sơ hoàn hảo!", " Profile complete!")}</> : tr("Hoàn thiện hồ sơ", "Complete your profile")}
          </p>
          <p className="text-[11px] leading-snug text-slate-400">{done ? tr("Bạn đang nổi bật với nhà tuyển dụng.", "You stand out to employers.") : benefit}</p>
        </div>
      </div>

      {!done && compact && nextItem && (
        <Link
          href="/profile"
          className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-pink-500/40 transition-colors"
        >
          <span className="truncate">{tr("Tiếp theo: ", "Next: ")}{nextItem.label}</span>
          <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-pink-400" />
        </Link>
      )}

      {!compact && (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.key} className={`flex items-center gap-2 text-xs ${item.done ? "text-slate-500 line-through" : "text-slate-200"}`}>
              {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" /> : <Circle className="h-4 w-4 text-slate-600 flex-shrink-0" />}
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
