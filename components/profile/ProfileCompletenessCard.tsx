"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Trophy } from "lucide-react";
import type { Completeness } from "@/lib/profileCompleteness";

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
  const { percent, items, nextItem } = completeness;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const done = percent >= 100;
  const benefit =
    role === "OWNER"
      ? "Hồ sơ tiệm đầy đủ giúp thợ tin tưởng và gọi nhiều hơn."
      : "Hồ sơ đầy đủ được chủ tiệm chú ý và nhắn tin nhiều hơn.";

  return (
    <div className="rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-slate-900/40 to-violet-500/10 p-4">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 flex-shrink-0" role="img" aria-label={`Hồ sơ hoàn thiện ${percent}%`}>
          <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
            <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="4" />
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke="url(#completeGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percent / 100)}
              className="transition-[stroke-dashoffset] duration-700"
            />
            <defs>
              <linearGradient id="completeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">{percent}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white flex items-center gap-1.5">
            {done ? <><Trophy className="h-4 w-4 text-amber-400" /> Hồ sơ hoàn hảo!</> : "Hoàn thiện hồ sơ"}
          </p>
          <p className="text-[11px] leading-snug text-slate-400">{done ? "Bạn đang nổi bật với nhà tuyển dụng." : benefit}</p>
        </div>
      </div>

      {!done && compact && nextItem && (
        <Link
          href="/profile"
          className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-pink-500/40 transition-colors"
        >
          <span className="truncate">Tiếp theo: {nextItem.label}</span>
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
