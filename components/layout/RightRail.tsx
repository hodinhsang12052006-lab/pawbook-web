"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, Flame, ShieldCheck, MapPin, ChevronRight } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { getDailyTip } from "@/lib/dailyTips";
import { stateName } from "@/lib/stateNames";

interface RailJob {
  id: string;
  title: string;
  salonName: string;
  city: string;
  state: string;
  market: "US" | "AU";
  salaryAmount: string;
  isUrgent: boolean;
}

// Cột phải trang chủ (màn ≥1280px) — trước đây 2 bên nội dung là khoảng đen
// trống. Lấp bằng nội dung có ích thật: mẹo trong ngày, tin gấp mới nhất ở
// đúng khu vực đang lọc, và quy tắc cộng đồng (tăng niềm tin).
export default function RightRail({ market, state }: { market: "US" | "AU"; state: string }) {
  const { user } = useSessionUser();
  const tip = getDailyTip(user?.role);
  const [jobs, setJobs] = useState<RailJob[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ market });
    if (state) params.set("state", state);
    fetch(`/api/jobs?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RailJob[]) => {
        if (!cancelled) setJobs(Array.isArray(data) ? data.filter((j) => j.isUrgent).slice(0, 4) : []);
      })
      .catch(() => !cancelled && setJobs([]));
    return () => {
      cancelled = true;
    };
  }, [market, state]);

  return (
    <aside className="hidden xl:block w-72 flex-shrink-0">
      <div className="sticky top-20 space-y-4">
        <section className="glass-card rounded-2xl p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Lightbulb className="h-4 w-4" /> Mẹo hôm nay
          </h3>
          <p className="mt-2 text-sm font-bold text-white">{tip.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{tip.body}</p>
        </section>

        <section className="glass-card rounded-2xl p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
            <Flame className="h-4 w-4" /> Tin gấp mới nhất
          </h3>
          <div className="mt-3 space-y-2">
            {jobs === null &&
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14" />)}
            {jobs?.length === 0 && <p className="text-xs text-slate-500">Chưa có tin gấp ở khu vực này.</p>}
            {jobs?.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="group block rounded-xl border border-slate-800/80 bg-slate-950/40 p-2.5 hover:border-pink-500/40 transition-colors"
              >
                <p className="truncate text-[13px] font-semibold text-slate-100 group-hover:text-white">{job.title}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {job.city}, {stateName(job.market, job.state)}
                </p>
                <p className="mt-1 text-[11px] font-bold text-emerald-400">{job.salaryAmount}</p>
              </Link>
            ))}
          </div>
          <Link href="/?tab=jobs" className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-pink-300 hover:text-pink-200">
            Xem tất cả tin <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="glass-card rounded-2xl p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-4 w-4" /> Cộng đồng an toàn
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-400">
            <li>• Không chuyển tiền đặt cọc cho người lạ.</li>
            <li>• Thoả thuận lương, chỗ ở qua tin nhắn trong app.</li>
            <li>• Gặp nội dung lừa đảo? Bấm <span className="text-slate-200">⋮ → Báo cáo</span> trong chat.</li>
          </ul>
        </section>

        <p className="px-1 text-[11px] text-slate-600">
          <Link href="/terms" className="hover:text-slate-400">Điều khoản</Link> ·{" "}
          <Link href="/privacy" className="hover:text-slate-400">Bảo mật</Link> · © 2026 PawNail Jobs
        </p>
      </div>
    </aside>
  );
}
