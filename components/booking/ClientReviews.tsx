"use client";

import React, { useEffect, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// "Khách nói gì" trên menu thợ: CHỈ từ khách đã đặt lịch qua PawNail (link riêng sau buổi làm).
interface R { id: string; rating: number; comment: string | null; displayName: string; itemName: string | null; createdAt: string }

export default function ClientReviews({ techId }: { techId: string }) {
  useTr();
  const [d, setD] = useState<{ average: number | null; count: number; reviews: R[] } | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    fetch(`/api/client-reviews?techId=${encodeURIComponent(techId)}`).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
  }, [techId]);
  if (!d || d.count === 0) return null;
  const list = all ? d.reviews : d.reviews.slice(0, 3);
  return (
    <section aria-label={tr("Đánh giá từ khách", "Client reviews")} className="space-y-3 rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-black text-white">{d.average?.toFixed(1)}</span>
        <div>
          <div className="flex" aria-label={tr(`${d.average} trên 5 sao`, `${d.average} out of 5`)}>
            {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= Math.round(d.average ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-600"}`} />)}
          </div>
          <p className="text-xs text-slate-400">{tr(`${d.count} đánh giá từ khách đã đặt lịch`, `${d.count} reviews from verified bookings`)}</p>
        </div>
      </div>
      <ul className="space-y-2.5">
        {list.map((r) => (
          <li key={r.id} className="rounded-2xl bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <span className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-600"}`} />)}</span>
              <span className="text-xs font-bold text-white">{r.displayName}</span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-300"><BadgeCheck className="h-3 w-3" />{tr("Khách đã đặt lịch", "Verified booking")}</span>
            </div>
            {r.comment && <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{r.comment}</p>}
            {r.itemName && <p className="mt-1 text-[11px] text-slate-500">{r.itemName}</p>}
          </li>
        ))}
      </ul>
      {d.reviews.length > 3 && !all && <button type="button" onClick={() => setAll(true)} className="text-xs font-bold text-pink-300 hover:underline">{tr(`Xem tất cả ${d.count} đánh giá`, `See all ${d.count} reviews`)}</button>}
    </section>
  );
}
