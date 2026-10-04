"use client";

// Các khối dùng trên trang hồ sơ công khai (app/profile/[uid]/page.tsx) — tách
// ra cho trang chính gọn, dễ đọc và dễ sửa.
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Play, Star, Images, ShieldCheck, Send, BadgeCheck, PenSquare } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/feedFormat";
import { playSound } from "@/lib/sounds";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

// 5 sao chạm-để-chọn, dùng chung cho cả hiển thị (readOnly) lẫn form đánh giá.
export function StarPicker({ value, onChange, readOnly, size = "h-5 w-5" }: { value: number; onChange?: (v: number) => void; readOnly?: boolean; size?: string }) {
  useTr(); // render lại khi đổi VI/EN
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          aria-label={readOnly ? undefined : `${n} sao`}
          className={readOnly ? "cursor-default" : "cursor-pointer active:scale-90 transition-transform"}
        >
          <Star className={`${size} ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-700"}`} />
        </button>
      ))}
    </div>
  );
}

export interface ReviewItem {
  id: string;
  type: "SALON_REVIEW" | "TECHNICIAN_REVIEW";
  overall: number;
  punctualityOrPay: number | null;
  environment: number | null;
  turnFairness: number | null;
  skillAccuracy: number | null;
  workEthic: number | null;
  customerAttitude: number | null;
  comment: string;
  isVerifiedConnection: boolean;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; role: string };
}

export interface ReviewSummary {
  count: number;
  avgOverall: number | null;
  avgPunctualityOrPay: number | null;
  avgEnvironment: number | null;
  avgTurnFairness: number | null;
  avgSkillAccuracy: number | null;
  avgWorkEthic: number | null;
  avgCustomerAttitude: number | null;
}

export interface GalleryPost {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
}

// Cấu hình 2 bộ tiêu chí theo chiều đánh giá — targetRole quyết định chiều:
// target=OWNER → viewer (Thợ) chấm SALON_REVIEW; target=TECHNICIAN → viewer
// (Chủ tiệm) chấm TECHNICIAN_REVIEW. Field key khớp 1-1 với app/api/reviews.
// Hàm (không phải hằng) để nhãn đổi theo VI/EN.
export const CRITERIA_BY_TARGET_ROLE = (): Record<
  "OWNER" | "TECHNICIAN",
  { key: "punctualityOrPay" | "environment" | "turnFairness" | "skillAccuracy" | "workEthic" | "customerAttitude"; label: string; summaryLabel: string }[]
> => ({
  OWNER: [
    { key: "punctualityOrPay", label: tr("Sòng phẳng lương/giờ giấc", "Fair pay & hours"), summaryLabel: tr("Sòng phẳng", "Fair pay") },
    { key: "environment", label: tr("Môi trường làm việc", "Work environment"), summaryLabel: tr("Môi trường", "Environment") },
    { key: "turnFairness", label: tr("Công bằng chia turn", "Fair turn sharing"), summaryLabel: "Chia turn" },
  ],
  TECHNICIAN: [
    { key: "skillAccuracy", label: tr("Tay nghề đúng như quảng cáo", "Skills as advertised"), summaryLabel: tr("Tay nghề", "Skills") },
    { key: "workEthic", label: tr("Chăm chỉ, đúng giờ", "Hardworking, punctual"), summaryLabel: tr("Chăm chỉ", "Work ethic") },
    { key: "customerAttitude", label: tr("Thái độ với khách", "Attitude with clients"), summaryLabel: tr("Thái độ", "Attitude") },
  ],
});

export const SUMMARY_KEY_FOR: Record<string, keyof ReviewSummary> = {
  punctualityOrPay: "avgPunctualityOrPay",
  environment: "avgEnvironment",
  turnFairness: "avgTurnFairness",
  skillAccuracy: "avgSkillAccuracy",
  workEthic: "avgWorkEthic",
  customerAttitude: "avgCustomerAttitude",
};

export const fmtScore =(v: number | null | undefined) => (v == null ? "—" : Number(v).toFixed(1));

// Tiêu đề khối nội dung — thống nhất icon + chữ cho mọi section.
export function SectionTitle({ icon: Icon, children, tone = "text-pink-300" }: { icon: typeof Star; children: React.ReactNode; tone?: string }) {
  useTr(); // render lại khi đổi VI/EN
  return (
    <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-slate-300">
      <Icon className={`h-4 w-4 ${tone}`} /> {children}
    </h3>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: typeof Star; title: string; hint?: string }) {
  useTr(); // render lại khi đổi VI/EN
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
        <Icon className="h-5 w-5 text-slate-500" />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// Bảng đánh giá 2 chiều minh bạch + form gửi đánh giá. `targetRole` quyết
// định bộ 3 tiêu chí + ai được phép gửi (chiều ngược lại với targetRole).
// Điểm số tổng hợp lấy thật từ bảng Review, KHÔNG có số liệu "lượng
// khách/ngày" hay "tỉ lệ tip cao" giả định vì hệ thống chưa có nguồn dữ
// liệu POS/booking thật nào để tính.
export function ReviewsSection({
  targetUserId,
  targetRole,
  viewerId,
  viewerRole,
  onChanged,
}: {
  targetUserId: string;
  targetRole: "OWNER" | "TECHNICIAN";
  viewerId: string | null;
  viewerRole: string | null;
  onChanged?: () => void;
}) {
  useTr(); // render lại khi đổi VI/EN
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const criteria = CRITERIA_BY_TARGET_ROLE()[targetRole];
  const [overall, setOverall] = useState(0);
  const [criteriaValues, setCriteriaValues] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reviews?targetUserId=${targetUserId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setSummary(data.summary);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  // Chủ tiệm chỉ được review Thợ, Thợ chỉ được review Chủ tiệm — không cho
  // cùng vai trò tự chấm nhau (VD: 2 chủ tiệm không review được nhau).
  const requiredViewerRole = targetRole === "OWNER" ? "TECHNICIAN" : "OWNER";
  const canReview = Boolean(viewerId && viewerId !== targetUserId && viewerRole === requiredViewerRole);

  const handleSubmit = async () => {
    if (!overall || criteria.some((c) => !criteriaValues[c.key])) {
      toast.error(tr("Vui lòng chấm đủ cả 4 tiêu chí.", "Please rate all 4 criteria."));
      return;
    }
    if (!comment.trim()) {
      toast.error(tr("Vui lòng viết vài dòng nhận xét.", "Please write a few words."));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, overall, comment: comment.trim(), ...criteriaValues }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || tr("Không thể gửi đánh giá.", "Couldn't submit the review."));
        return;
      }
      toast.success(tr("Đã gửi đánh giá — cảm ơn bạn! 🙏", "Review submitted — thank you! 🙏"));
      playSound("success");
      setShowForm(false);
      setOverall(0);
      setCriteriaValues({});
      setComment("");
      load();
      onChanged?.();
    } catch {
      toast.error(tr("Lỗi mạng. Vui lòng thử lại.", "Network error. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tổng quan điểm: số lớn bên trái + thanh điểm từng tiêu chí */}
      <div className="glass-card grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl p-5">
        <div className="text-center">
          <p className="text-4xl font-black tracking-tight text-white">{fmtScore(summary?.avgOverall)}</p>
          <StarPicker value={Math.round(summary?.avgOverall ?? 0)} readOnly size="h-3.5 w-3.5" />
          <p className="mt-1 text-[11px] text-slate-500">{summary?.count ?? 0}{tr(" đánh giá", " reviews")}</p>
        </div>
        <div className="space-y-2.5">
          {criteria.map((c) => {
            const v = summary?.[SUMMARY_KEY_FOR[c.key]] as number | null | undefined;
            return (
              <div key={c.key} className="grid grid-cols-[72px_1fr_28px] items-center gap-2.5">
                <span className="text-[11px] font-semibold text-slate-400">{c.summaryLabel}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300" style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                </span>
                <span className="text-right text-[11px] font-bold text-slate-200">{fmtScore(v)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {canReview && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm font-bold text-slate-300 transition-all hover:border-pink-500/50 hover:bg-pink-500/[0.04] hover:text-pink-200"
        >
          <PenSquare className="h-4 w-4" /> {targetRole === "OWNER" ? tr("Viết đánh giá cho tiệm này", "Review this salon") : tr("Viết đánh giá cho thợ này", "Review this tech")}
        </button>
      )}

      {showForm && (
        <div className="glass-card space-y-4 rounded-2xl p-4 animate-fadeIn">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2.5 ring-1 ring-white/5">
              <span className="text-xs font-bold text-slate-300">{tr("Điểm tổng thể", "Overall score")}</span>
              <StarPicker value={overall} onChange={setOverall} />
            </div>
            {criteria.map((c) => (
              <div key={c.key} className="flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2.5 ring-1 ring-white/5">
                <span className="text-xs font-bold text-slate-300">{c.label}</span>
                <StarPicker
                  value={criteriaValues[c.key] || 0}
                  onChange={(v) => setCriteriaValues((prev) => ({ ...prev, [c.key]: v }))}
                />
              </div>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={targetRole === "OWNER" ? tr("Chia sẻ trải nghiệm thật của bạn với tiệm này...", "Share your real experience with this salon...") : tr("Chia sẻ trải nghiệm thật của bạn với thợ này...", "Share your real experience with this tech...")}
            className="input-field"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={submitting}
              className="flex-1 min-h-[44px] rounded-xl border border-white/10 text-sm font-bold text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              {tr("Hủy", "Cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-bold text-white shadow-lg shadow-pink-600/20 hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {tr("Gửi đánh giá", "Submit review")}
            </button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={tr("Chưa có đánh giá nào", "No reviews yet")} hint={tr("Đánh giá chỉ đến từ người từng làm việc thật — hãy là người đầu tiên.", "Reviews only come from people who actually worked together — be the first.")} />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <article key={r.id} className="glass-card space-y-2.5 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${r.author.id}`}>
                  <Avatar src={r.author.avatarUrl} name={r.author.name} seed={r.author.id} className="h-9 w-9 ring-1 ring-white/10" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/profile/${r.author.id}`} className="truncate text-sm font-bold text-slate-100 hover:text-pink-300">{r.author.name}</Link>
                    {r.isVerifiedConnection && (
                      <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/25" title={tr("Hai bên đã thực sự kết nối trên PawNail", "Both sides actually connected on PawNail")}>
                        <BadgeCheck className="h-3 w-3" />{tr(" Đã kết nối thật", " Verified connection")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StarPicker value={r.overall} readOnly size="h-3 w-3" />
                    <span className="text-[11px] text-slate-500">{timeAgo(r.createdAt)}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">{r.comment}</p>
              <div className="flex flex-wrap gap-1.5">
                {criteria.map((c) => (
                  <span key={c.key} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-400 ring-1 ring-white/5">
                    {c.summaryLabel} · {r[c.key]}★
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function MediaGrid({ urls }: { urls: string[] }) {
  useTr(); // render lại khi đổi VI/EN
  return (
    <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl">
      {urls.map((url, idx) => (
        <div key={idx} className="group relative aspect-square overflow-hidden bg-slate-900">
          {isVideoUrl(url) ? (
            <>
              <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              <span className="absolute inset-0 m-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur">
                <Play className="h-4 w-4 fill-white text-white" />
              </span>
            </>
          ) : (
            <Image src={url} alt="" fill loading="lazy" sizes="(max-width: 768px) 33vw, 260px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
          )}
        </div>
      ))}
    </div>
  );
}

// "Bằng chứng tiệm đông khách" — tái dùng Post(postType=SHOWCASE) của chính
// chủ tiệm này làm gallery, không tạo bảng riêng để tránh trùng dữ liệu với
// newsfeed (xem comment trong prisma/schema.prisma tại model Post).
export function GallerySection({ ownerId }: { ownerId: string }) {
  useTr(); // render lại khi đổi VI/EN
  const [posts, setPosts] = useState<GalleryPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts?authorId=${ownerId}&postType=SHOWCASE`)
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => {
        if (!cancelled) setPosts(data.posts);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  if (posts === null) {
    return <div className="grid grid-cols-3 gap-1.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton aspect-square rounded-xl" />)}</div>;
  }
  const media = posts.flatMap((p) => p.mediaUrls);
  if (media.length === 0) {
    return <EmptyState icon={Images} title={tr("Chưa có ảnh tiệm", "No salon photos yet")} hint='Ảnh/video đăng mục "Khoe tiệm" trên bảng tin sẽ hiện ở đây.' />;
  }
  return <MediaGrid urls={media} />;
}

export function ProfileSkeleton() {
  useTr(); // render lại khi đổi VI/EN
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 md:px-6 md:pt-6">
      <div className="overflow-hidden md:rounded-3xl md:border md:border-white/10">
        <div className="skeleton h-32 rounded-none sm:h-44" />
        <div className="space-y-3 px-4 pb-6 sm:px-6">
          <div className="-mt-12 h-24 w-24 rounded-full border-4 border-slate-950 bg-slate-800" />
          <div className="skeleton h-7 w-48 rounded-lg" />
          <div className="skeleton h-4 w-64 rounded-lg" />
          <div className="skeleton h-11 w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}

