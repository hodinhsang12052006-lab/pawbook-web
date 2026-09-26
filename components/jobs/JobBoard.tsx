"use client";

import React, { useEffect, useState } from "react";
import { MapPin, DollarSign, Phone, MessageCircle, AlertCircle, Flame, TrendingUp, Clock, Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { TOTAL_DEMAND_COUNT, DEMAND_SIGNAL } from "@/lib/nailRadarData";
import { stateName } from "@/lib/stateNames";

export interface JobType {
  id: string;
  title: string;
  salonName: string;
  description: string;
  market: "US" | "AU";
  state: string;
  city: string;
  salaryType: string;
  salaryAmount: string;
  skills: string[];
  benefits: string[];
  phone: string;
  isUrgent: boolean;
  createdAt: string;
  ownerId: string;
  owner?: { id: string; name: string; avatarUrl: string | null } | null;
}

interface JobBoardProps {
  market: "US" | "AU";
  state: string;
  city: string;
}

// Hiệu ứng bấm nút kiểu app native
const PRESS = "active:scale-95 transition-transform duration-100";

// Thợ lướt bằng 1 ngón (thường móng dài), quét nhanh qua card — khớp icon
// theo từ khoá trong quyền lợi tự do (benefits là text tự nhập, không phải
// enum) để biến dòng chữ khô khan thành badge dễ quét bằng mắt.
const BENEFIT_ICON_RULES: Array<{ match: RegExp; icon: string }> = [
  { match: /chỗ ở|housing/i, icon: "🏠" },
  { match: /đưa đón|xe\b/i, icon: "🚗" },
  { match: /tip cao/i, icon: "💵" },
  { match: /visa/i, icon: "🛂" },
  { match: /bao lương/i, icon: "💰" },
  { match: /đổi bang/i, icon: "🔄" },
];

function benefitIcon(text: string): string {
  return BENEFIT_ICON_RULES.find((r) => r.match.test(text))?.icon || "🎁";
}

// "Mới đăng X trước" — tính thật từ createdAt, không phải số bịa, nhưng vẫn
// tạo cảm giác khan hiếm/mới tự nhiên (tin càng mới càng dễ khiến thợ bấm
// vào ngay thay vì lướt qua rồi quên).
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "vừa đăng";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// Banner "cầu thợ thực tế" — tái dùng đúng số liệu tổng hợp/ẩn danh đã tính
// cho Nail Radar (lib/nailRadarData.ts), để tab "Cần Thợ Gấp" mở ra là thợ
// thấy ngay bằng chứng có thật rằng thị trường đang khát nhân lực, thay vì
// chỉ có mỗi danh sách tin — đúng tinh thần giữ chân thợ mới vào nền tảng.
function DemandFomoBanner({ market, state }: { market: "US" | "AU"; state: string }) {
  const stateSignal = state ? DEMAND_SIGNAL[market]?.[state] : null;
  const count = stateSignal?.demandCount ?? TOTAL_DEMAND_COUNT[market];
  const scopeLabel = stateSignal ? `tại ${stateName(market, state)}` : market === "US" ? "tại Mỹ" : "tại Úc";

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/40 via-slate-900/30 to-slate-900/30 px-4 py-3">
      <TrendingUp className="h-5 w-5 text-emerald-400 flex-shrink-0" />
      <p className="text-xs sm:text-sm text-slate-200">
        <span className="font-black text-emerald-400">{count}+ tiệm</span> {scopeLabel} đang cần tuyển thợ ngay bây giờ — ứng tuyển sớm để không bị tiệm khác giành mất suất.
      </p>
    </div>
  );
}

// Khung skeleton đúng kích thước card thật — tránh layout shift/nhảy giật
// scroll khi đổi tab hoặc đổi vùng US/AU.
function JobCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-2/3 rounded bg-slate-800" />
          <div className="h-3 w-1/2 rounded bg-slate-800/70" />
        </div>
        <div className="h-5 w-12 rounded-full bg-slate-800 flex-shrink-0" />
      </div>
      <div className="h-8 w-32 rounded-xl bg-slate-800/80" />
      <div className="h-3.5 w-28 rounded bg-slate-800/70" />
      <div className="flex gap-1.5">
        <div className="h-5 w-16 rounded-full bg-slate-800/70" />
        <div className="h-5 w-20 rounded-full bg-slate-800/70" />
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-slate-850">
        <div className="h-12 flex-1 rounded-xl bg-slate-800" />
        <div className="h-12 flex-1 rounded-xl bg-slate-800/70" />
      </div>
    </div>
  );
}

function JobBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" aria-label="Đang tải tin tuyển thợ">
      {Array.from({ length: 6 }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function JobBoard({ market, state, city }: JobBoardProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchJobs() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ market });
        if (state) params.set("state", state);
        if (city) params.set("city", city);
        const res = await fetch(`/api/jobs?${params.toString()}`);
        if (!res.ok) throw new Error("Không thể tải danh sách tin tuyển dụng.");
        const data = await res.json();
        if (!cancelled) setJobs(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJobs();

    return () => {
      cancelled = true;
    };
  }, [market, state, city]);

  // Nạp danh sách đã lưu 1 lần khi mount — không phụ thuộc bộ lọc market/
  // state/city vì "đã lưu" là của riêng người dùng, không đổi theo bộ lọc.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs/saved")
      .then((res) => (res.ok ? res.json() : []))
      .then((ids: string[]) => {
        if (!cancelled) setSavedIds(new Set(ids));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleSave(jobId: string) {
    const isSaved = savedIds.has(jobId);
    // Optimistic update — thao tác lưu tin phải phản hồi tức thì, không đợi
    // network, vì đây chính là hành động "tôi sẽ quay lại xem cái này".
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
    try {
      await fetch(`/api/jobs/${jobId}/save`, { method: isSaved ? "DELETE" : "POST" });
    } catch {
      // Rollback nếu request lỗi
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(jobId);
        else next.delete(jobId);
        return next;
      });
    }
  }

  const visibleJobs = showSavedOnly ? jobs.filter((j) => savedIds.has(j.id)) : jobs;

  if (loading) {
    return <JobBoardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="space-y-4">
        <DemandFomoBanner market={market} state={state} />
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <p className="text-4xl">💅</p>
          <p className="text-base font-bold text-slate-300">Chưa có tin tuyển thợ ở khu vực này</p>
          <p className="text-sm text-slate-500">
            Nhưng đừng bỏ cuộc — thử đổi bang hoặc thành phố khác, {market === "US" ? "toàn nước Mỹ" : "toàn nước Úc"} vẫn còn rất nhiều tiệm đang cần thợ.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <DemandFomoBanner market={market} state={state} />

      <button
        onClick={() => setShowSavedOnly((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold border transition-colors ${
          showSavedOnly
            ? "border-pink-500 bg-pink-500/15 text-pink-300"
            : "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200"
        }`}
      >
        <Bookmark className={`h-3.5 w-3.5 ${showSavedOnly ? "fill-pink-400" : ""}`} />
        Đã lưu {savedIds.size > 0 && `(${savedIds.size})`}
      </button>

      {showSavedOnly && visibleJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <Bookmark className="h-8 w-8 text-slate-700" />
          <p className="text-base font-bold text-slate-300">Bạn chưa lưu tin nào</p>
          <p className="text-sm text-slate-500">Bấm biểu tượng bookmark trên tin ưng ý để xem lại sau.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {visibleJobs.map((job) => (
        <div
          key={job.id}
          className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-5 space-y-3 hover:border-pink-500/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white leading-snug truncate">{job.title}</h3>
              <p className="text-sm text-slate-400 font-semibold truncate">{job.salonName}</p>
            </div>
            <button
              onClick={() => toggleSave(job.id)}
              aria-label={savedIds.has(job.id) ? "Bỏ lưu tin" : "Lưu tin"}
              className="flex-shrink-0 p-1.5 -m-1.5 text-slate-500 hover:text-pink-400 active:scale-90 transition-all"
            >
              <Bookmark className={`h-5 w-5 ${savedIds.has(job.id) ? "fill-pink-400 text-pink-400" : ""}`} />
            </button>
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              {job.isUrgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-400 border border-red-500/30">
                  <Flame className="h-3 w-3" /> Gấp
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <Clock className="h-3 w-3" /> {timeAgo(job.createdAt)}
              </span>
            </div>
          </div>

          {/* Con số lương — thứ đầu tiên thợ nhìn vào, phải to/đậm/tương
              phản nhất card, đứng riêng thành 1 badge thay vì chữ thường
              lẫn trong hàng thông tin. */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 pl-2.5 pr-3 py-1.5 shadow-lg shadow-emerald-500/20">
              <DollarSign className="h-5 w-5 text-emerald-950" />
              <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight leading-none">
                {job.salaryAmount}
              </span>
            </span>
            <span className="text-xs text-slate-500 font-semibold">{job.salaryType}</span>
          </div>

          <span className="flex items-center gap-1.5 text-sm text-slate-300">
            <MapPin className="h-4 w-4 text-slate-500 flex-shrink-0" />
            {job.city}, {stateName(job.market, job.state)}
          </span>

          {job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-pink-500/10 border border-pink-500/25 px-2.5 py-1 text-[11px] font-semibold text-pink-300">
                  {skill}
                </span>
              ))}
            </div>
          )}

          {job.benefits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.benefits.map((benefit) => (
                <span
                  key={benefit}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 text-[11px] font-bold text-amber-300"
                >
                  {benefitIcon(benefit)} {benefit}
                </span>
              ))}
            </div>
          )}

          {/* CTA — kích thước chạm ngón tay cái chuẩn (min 48px), chữ to rõ
              để bấm không trượt kể cả móng dài. */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-850">
            <a
              href={`tel:${job.phone}`}
              className={`flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-base font-bold text-white ${PRESS}`}
            >
              <Phone className="h-5 w-5" />
              Gọi ngay
            </a>
            <button
              onClick={() => router.push(`/messages?to=${job.ownerId}`)}
              className={`flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-base font-bold text-slate-100 ${PRESS}`}
            >
              <MessageCircle className="h-5 w-5" />
              Nhắn tin
            </button>
          </div>
        </div>
      ))}
      </div>
      )}
    </div>
  );
}
