"use client";

import React, { useEffect, useState } from "react";
import { MapPin, DollarSign, Phone, MessageCircle, AlertCircle, Flame } from "lucide-react";
import { useRouter } from "next/navigation";

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
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-4xl">💅</p>
        <p className="text-base font-bold text-slate-300">Chưa có tin tuyển thợ ở khu vực này</p>
        <p className="text-sm text-slate-500">Hãy thử đổi bang hoặc thành phố khác.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-5 space-y-3 hover:border-pink-500/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white leading-snug truncate">{job.title}</h3>
              <p className="text-sm text-slate-400 font-semibold truncate">{job.salonName}</p>
            </div>
            {job.isUrgent && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-400 border border-red-500/30">
                <Flame className="h-3 w-3" /> Gấp
              </span>
            )}
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
            {job.city}, {job.state}
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
  );
}
