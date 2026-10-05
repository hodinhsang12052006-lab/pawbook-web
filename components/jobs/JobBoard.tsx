"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin, DollarSign, Phone, MessageCircle, AlertCircle, Flame, TrendingUp, Clock, Bookmark, Eye, Zap } from "lucide-react";
import { trackJobContact, trackJobView } from "@/lib/viewTracker";
import { isVideoUrl } from "@/lib/mediaUpload";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TOTAL_DEMAND_COUNT, DEMAND_SIGNAL } from "@/lib/nailRadarData";
import { stateName } from "@/lib/stateNames";
import { tr } from "@/lib/i18n/tr";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { useTr } from "@/lib/i18n/useTr";
import { JobAlertButton } from "@/components/jobs/JobAlerts";
import { useSessionUser } from "@/lib/SessionUserContext";
import { dt } from "@/lib/i18n/dataEn";

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
  saveCount?: number;
  heat?: { viewsToday: number; contacts7d: number; hot: boolean };
  mediaUrls?: string[];
}

// Ngưỡng hiển thị (khớp lib/jobStats HEAT_MIN) — số nhỏ quá thì ẩn, tránh
// cảm giác "vắng". File này là client nên không import thẳng lib/jobStats.
const MIN_VIEWS_TODAY = 3;
const MIN_CONTACTS = 2;
const MIN_SAVES = 2;

const NEW_JOB_MS = 24 * 60 * 60 * 1000;

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
  if (mins < 1) return tr("vừa đăng", "just posted");
  if (mins < 60) return tr(`${mins} phút trước`, `${mins}m ago`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr(`${hours} giờ trước`, `${hours}h ago`);
  const days = Math.floor(hours / 24);
  return tr(`${days} ngày trước`, `${days}d ago`);
}

// Banner "nhịp thị trường": ưu tiên số LIVE từ chính các tin đang mở trên
// app (đủ ≥3 tin mới hiện); app còn ít dữ liệu thì dùng số khảo sát cộng đồng
// và GHI RÕ nguồn + thời điểm — không nói "ngay bây giờ" với số cũ.
function DemandFomoBanner({ market, state, jobs }: { market: "US" | "AU"; state: string; jobs: JobType[] }) {
  useTr(); // render lại khi đổi VI/EN
  const scope = state ? stateName(market, state) : market === "US" ? tr("Mỹ", "the US") : tr("Úc", "Australia");
  const weekAgo = Date.now() - 7 * 86_400_000;
  const newThisWeek = jobs.filter((j) => new Date(j.createdAt).getTime() >= weekAgo).length;
  const urgent = jobs.filter((j) => j.isUrgent).length;

  if (jobs.length >= 3) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/50 via-slate-900/40 to-slate-900/30 px-4 py-3">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <p className="text-xs text-slate-200 sm:text-sm">
          <span className="font-black text-emerald-300">{jobs.length}{tr(" tin đang tuyển", " open jobs")}</span>{tr(" tại ", " in ")}{scope}
          {newThisWeek > 0 && <> · <span className="font-bold text-white">{newThisWeek}{tr(" tin mới", " new")}</span>{tr(" trong 7 ngày", " in 7 days")}</>}
          {urgent > 0 && <> · <span className="font-bold text-orange-300">{urgent}{tr(" tin gấp", " urgent")}</span></>}
        </p>
      </div>
    );
  }

  const stateSignal = state ? DEMAND_SIGNAL[market]?.[state] : null;
  const count = stateSignal?.demandCount ?? TOTAL_DEMAND_COUNT[market];
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/40 via-slate-900/30 to-slate-900/30 px-4 py-3">
      <TrendingUp className="h-5 w-5 flex-shrink-0 text-emerald-400" />
      <p className="text-xs text-slate-200 sm:text-sm">
        <span className="font-black text-emerald-400">{count}{tr("+ tin chủ tìm thợ", "+ salon hiring posts")}</span>{tr(" tại ", " in ")}{stateSignal ? scope : market === "US" ? tr("Mỹ", "the US") : tr("Úc", "Australia")}{tr(" trong 1 đợt khảo sát nhóm nail (9/2026) — thợ đang là bên được săn đón.", " in one survey of nail groups (Sep 2026) — techs are in demand.")}
      </p>
    </div>
  );
}

// Khung skeleton đúng kích thước card thật — tránh layout shift/nhảy giật
// scroll khi đổi tab hoặc đổi vùng US/AU.
function JobCardSkeleton() {
  useTr(); // render lại khi đổi VI/EN
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3 animate-pulse">
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
  useTr(); // render lại khi đổi VI/EN
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" aria-label={tr("Đang tải tin tuyển thợ", "Loading jobs")}>
      {Array.from({ length: 6 }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

function JobCard({
  job, saved, saveCount, onToggleSave, onMessage, nearYou = false,
}: { job: JobType; saved: boolean; saveCount: number; onToggleSave: () => void; onMessage: () => void; nearYou?: boolean }) {
  useTr(); // render lại khi đổi VI/EN
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => trackJobView(ref.current, job.id), [job.id]);
  const heat = job.heat;
  const isNew = Date.now() - new Date(job.createdAt).getTime() < NEW_JOB_MS;

  // Tín hiệu "đám đông" THẬT, chỉ hiện khi vượt ngưỡng.
  const signals: { icon: typeof Eye; text: string }[] = [];
  if (heat && heat.viewsToday >= MIN_VIEWS_TODAY) signals.push({ icon: Eye, text: tr(`${heat.viewsToday} người xem hôm nay`, `${heat.viewsToday} viewed today`) });
  if (heat && heat.contacts7d >= MIN_CONTACTS) signals.push({ icon: MessageCircle, text: tr(`${heat.contacts7d} người đã liên hệ tuần này`, `${heat.contacts7d} contacted this week`) });
  if (saveCount >= MIN_SAVES) signals.push({ icon: Bookmark, text: tr(`${saveCount} người đã lưu`, `${saveCount} saved`) });

  return (
    <div
      ref={ref}
      className={`glass-card relative space-y-3 rounded-2xl p-4 transition-colors hover:border-pink-500/40 sm:p-5 ${heat?.hot ? "!border-orange-500/40 shadow-[0_0_0_1px_rgba(249,115,22,0.15),0_12px_40px_-16px_rgba(249,115,22,0.45)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold leading-snug text-white hover:text-pink-200">{dt(job.title)}</h3>
          <p className="truncate text-sm font-semibold text-slate-400">{job.salonName}</p>
        </Link>
        <button
          onClick={onToggleSave}
          aria-label={saved ? tr("Bỏ lưu tin", "Unsave job") : tr("Lưu tin", "Save job")}
          className="-m-1.5 flex-shrink-0 p-1.5 text-slate-500 transition-all hover:text-pink-400 active:scale-90"
        >
          <Bookmark className={`h-5 w-5 ${saved ? "fill-pink-400 text-pink-400" : ""}`} />
        </button>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            {heat?.hot && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2 py-1 text-[11px] font-black text-white shadow-lg shadow-orange-500/30" title={tr("Nhiều người xem / liên hệ tin này", "Many people are viewing / contacting this job")}>
                <Zap className="h-3 w-3 fill-white" />{tr(" Đang hot", " Hot")}
              </span>
            )}
            {isNew && !heat?.hot && (
              <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-300">{tr("✨ Mới", "✨ New")}</span>
            )}
            {job.isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-400">
                <Flame className="h-3 w-3" />{tr(" Gấp", " Urgent")}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Clock className="h-3 w-3" /> {timeAgo(job.createdAt)}
          </span>
        </div>
      </div>

      {/* Ảnh / video tiệm — tin có hình được bấm xem nhiều hơn hẳn. */}
      {job.mediaUrls && job.mediaUrls.length > 0 && (
        <Link href={`/jobs/${job.id}`} className="relative -mx-4 block aspect-[16/9] overflow-hidden bg-slate-900 sm:-mx-5">
          {isVideoUrl(job.mediaUrls[0]) ? (
            <video src={job.mediaUrls[0]} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.mediaUrls[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {job.mediaUrls.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">📷 {job.mediaUrls.length}</span>
          )}
        </Link>
      )}

      {/* Con số lương — thứ đầu tiên thợ nhìn vào, phải to/đậm/tương phản nhất card. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-1.5 pl-2.5 pr-3 shadow-lg shadow-emerald-500/20">
          <DollarSign className="h-5 w-5 text-emerald-950" />
          <span className="text-xl font-black leading-none tracking-tight text-emerald-950 sm:text-2xl">{job.salaryAmount}</span>
        </span>
        <span className="text-xs font-semibold text-slate-500">{valueLabel(job.salaryType)}</span>
      </div>

      <span className="flex items-center gap-1.5 text-sm text-slate-300">
        <MapPin className="h-4 w-4 flex-shrink-0 text-slate-500" />
        {job.city}, {stateName(job.market, job.state)}
        {nearYou && <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">{tr("📍 Gần bạn", "📍 Near you")}</span>}
      </span>

      {signals.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-amber-500/[0.06] px-3 py-2 ring-1 ring-amber-500/15">
          {signals.map((sg) => (
            <span key={sg.text} className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200/90">
              <sg.icon className="h-3.5 w-3.5" /> {sg.text}
            </span>
          ))}
        </div>
      )}

      {job.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.skills.map((skill) => (
            <span key={skill} className="rounded-full border border-pink-500/25 bg-pink-500/10 px-2.5 py-1 text-[11px] font-semibold text-pink-300">{valueLabel(skill)}</span>
          ))}
        </div>
      )}

      {job.benefits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.benefits.map((benefit) => (
            <span key={benefit} className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
              {benefitIcon(benefit)} {valueLabel(benefit)}
            </span>
          ))}
        </div>
      )}

      {/* CTA — chạm ngón cái chuẩn (min 48px), chữ to rõ để móng dài bấm không trượt. */}
      <div className="flex items-center gap-2 border-t border-slate-850 pt-2">
        <a
          href={`tel:${job.phone}`}
          onClick={() => trackJobContact(job.id)}
          className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-base font-bold text-white hover:bg-emerald-600 ${PRESS}`}
        >
          <Phone className="h-5 w-5" />{tr(" Gọi ngay", " Call now")}
        </a>
        <button
          onClick={() => { trackJobContact(job.id); onMessage(); }}
          className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 text-base font-bold text-slate-100 hover:bg-slate-700 ${PRESS}`}
        >
          <MessageCircle className="h-5 w-5" />{tr(" Nhắn tin", " Message")}
        </button>
      </div>
    </div>
  );
}

export default function JobBoard({ market, state, city }: JobBoardProps) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const [jobs, setJobs] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // Tập "đã lưu" lúc tải — saveCount từ server đã tính cả lượt lưu của chính
  // người xem, nên chỉ cộng/trừ phần chênh lệch khi họ bấm lưu/bỏ lưu.
  const [initialSaved, setInitialSaved] = useState<Set<string>>(new Set());
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
        if (!res.ok) throw new Error(tr("Không thể tải danh sách tin tuyển dụng.", "Couldn't load jobs."));
        const data = await res.json();
        if (!cancelled) setJobs(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || tr("Đã xảy ra lỗi.", "Something went wrong."));
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
        if (!cancelled) {
          setInitialSaved(new Set(ids));
          setSavedIds(new Set(ids));
        }
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

  // "Tất cả bang": đưa tin ở BANG CỦA NGƯỜI XEM lên đầu (giữ thứ tự gấp/mới
  // trong từng nhóm) — không lọc mất tin nơi khác, nên không bao giờ trống trơn.
  const { user: viewer } = useSessionUser();
  const homeState = !state && viewer?.market === market ? viewer?.state || null : null;
  const ordered = homeState ? [...jobs.filter((j) => j.state === homeState), ...jobs.filter((j) => j.state !== homeState)] : jobs;
  const visibleJobs = showSavedOnly ? ordered.filter((j) => savedIds.has(j.id)) : ordered;

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
        <DemandFomoBanner market={market} state={state} jobs={jobs} />
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <p className="text-4xl">💅</p>
          <p className="text-base font-bold text-slate-300">{tr("Chưa có tin tuyển thợ ở khu vực này", "No jobs in this area yet")}</p>
          <JobAlertButton market={market} state={state} />
          <p className="text-sm text-slate-500">
            {tr("Nhưng đừng bỏ cuộc — thử đổi bang hoặc thành phố khác, ", "Don't give up — try another state or city, ")}{market === "US" ? tr("toàn nước Mỹ", "across the US") : tr("toàn nước Úc", "across Australia")}{tr(" vẫn còn rất nhiều tiệm đang cần thợ.", " plenty of salons are still hiring.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <DemandFomoBanner market={market} state={state} jobs={jobs} />

      <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setShowSavedOnly((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold border transition-colors ${
          showSavedOnly
            ? "border-pink-500 bg-pink-500/15 text-pink-300"
            : "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200"
        }`}
      >
        <Bookmark className={`h-3.5 w-3.5 ${showSavedOnly ? "fill-pink-400" : ""}`} />
        {tr("Đã lưu ", "Saved ")}{savedIds.size > 0 && `(${savedIds.size})`}
      </button>
      <JobAlertButton market={market} state={state} />
      </div>

      {showSavedOnly && visibleJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <Bookmark className="h-8 w-8 text-slate-700" />
          <p className="text-base font-bold text-slate-300">{tr("Bạn chưa lưu tin nào", "You haven't saved any jobs")}</p>
          <p className="text-sm text-slate-500">{tr("Bấm biểu tượng bookmark trên tin ưng ý để xem lại sau.", "Tap the bookmark icon on a job to come back to it later.")}</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {visibleJobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          saved={savedIds.has(job.id)}
          saveCount={(job.saveCount ?? 0) + (savedIds.has(job.id) ? 1 : 0) - (initialSaved.has(job.id) ? 1 : 0)}
          onToggleSave={() => toggleSave(job.id)}
          onMessage={() => router.push(`/messages?to=${job.ownerId}`)}
          nearYou={!!homeState && job.state === homeState}
        />
      ))}
      </div>
      )}
    </div>
  );
}
