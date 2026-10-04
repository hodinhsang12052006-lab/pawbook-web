"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import {
  Loader2, AlertCircle, MessageCircle, Flame, CheckCircle2, MapPin, Briefcase, Play, Lock,
  Star, Images, ShieldCheck, Send, BadgeCheck, HeartHandshake, Home as HomeIcon, Users2, Award,
  Store, Sparkles, CalendarDays, Share2, PenSquare, ChevronRight, LayoutGrid, DollarSign, Crown, Zap, Heart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useSessionUser } from "@/lib/SessionUserContext";
import UnlockChatModal from "@/components/profile/UnlockChatModal";
import Avatar from "@/components/ui/Avatar";
import { avatarGradient } from "@/lib/avatar";
import { stateName } from "@/lib/stateNames";
import { timeAgo } from "@/lib/feedFormat";

interface PageProps {
  params: Promise<{ uid: string }>;
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

// 5 sao chạm-để-chọn, dùng chung cho cả hiển thị (readOnly) lẫn form đánh giá.
function StarPicker({ value, onChange, readOnly, size = "h-5 w-5" }: { value: number; onChange?: (v: number) => void; readOnly?: boolean; size?: string }) {
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

interface ReviewItem {
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

interface ReviewSummary {
  count: number;
  avgOverall: number | null;
  avgPunctualityOrPay: number | null;
  avgEnvironment: number | null;
  avgTurnFairness: number | null;
  avgSkillAccuracy: number | null;
  avgWorkEthic: number | null;
  avgCustomerAttitude: number | null;
}

interface GalleryPost {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
}

// Cấu hình 2 bộ tiêu chí theo chiều đánh giá — targetRole quyết định chiều:
// target=OWNER → viewer (Thợ) chấm SALON_REVIEW; target=TECHNICIAN → viewer
// (Chủ tiệm) chấm TECHNICIAN_REVIEW. Field key khớp 1-1 với app/api/reviews.
const CRITERIA_BY_TARGET_ROLE: Record<
  "OWNER" | "TECHNICIAN",
  { key: "punctualityOrPay" | "environment" | "turnFairness" | "skillAccuracy" | "workEthic" | "customerAttitude"; label: string; summaryLabel: string }[]
> = {
  OWNER: [
    { key: "punctualityOrPay", label: "Sòng phẳng lương/giờ giấc", summaryLabel: "Sòng phẳng" },
    { key: "environment", label: "Môi trường làm việc", summaryLabel: "Môi trường" },
    { key: "turnFairness", label: "Công bằng chia turn", summaryLabel: "Chia turn" },
  ],
  TECHNICIAN: [
    { key: "skillAccuracy", label: "Tay nghề đúng như quảng cáo", summaryLabel: "Tay nghề" },
    { key: "workEthic", label: "Chăm chỉ, đúng giờ", summaryLabel: "Chăm chỉ" },
    { key: "customerAttitude", label: "Thái độ với khách", summaryLabel: "Thái độ" },
  ],
};

const SUMMARY_KEY_FOR: Record<string, keyof ReviewSummary> = {
  punctualityOrPay: "avgPunctualityOrPay",
  environment: "avgEnvironment",
  turnFairness: "avgTurnFairness",
  skillAccuracy: "avgSkillAccuracy",
  workEthic: "avgWorkEthic",
  customerAttitude: "avgCustomerAttitude",
};

const BADGE_STYLE = {
  founding: { icon: Crown, cls: "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-200 ring-amber-400/40" },
  fast_reply: { icon: Zap, cls: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30" },
  top_rated: { icon: Star, cls: "bg-amber-500/10 text-amber-200 ring-amber-500/30" },
  complete: { icon: BadgeCheck, cls: "bg-sky-500/10 text-sky-200 ring-sky-500/30" },
  loved: { icon: Heart, cls: "bg-pink-500/10 text-pink-200 ring-pink-500/30" },
} as const;

const fmtScore =(v: number | null | undefined) => (v == null ? "—" : Number(v).toFixed(1));

// Tiêu đề khối nội dung — thống nhất icon + chữ cho mọi section.
function SectionTitle({ icon: Icon, children, tone = "text-pink-300" }: { icon: typeof Star; children: React.ReactNode; tone?: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-slate-300">
      <Icon className={`h-4 w-4 ${tone}`} /> {children}
    </h3>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Star; title: string; hint?: string }) {
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
function ReviewsSection({
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
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const criteria = CRITERIA_BY_TARGET_ROLE[targetRole];
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
      toast.error("Vui lòng chấm đủ cả 4 tiêu chí.");
      return;
    }
    if (!comment.trim()) {
      toast.error("Vui lòng viết vài dòng nhận xét.");
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
        toast.error(data.error || "Không thể gửi đánh giá.");
        return;
      }
      toast.success("Đã gửi đánh giá — cảm ơn bạn! 🙏");
      setShowForm(false);
      setOverall(0);
      setCriteriaValues({});
      setComment("");
      load();
      onChanged?.();
    } catch {
      toast.error("Lỗi mạng. Vui lòng thử lại.");
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
          <p className="mt-1 text-[11px] text-slate-500">{summary?.count ?? 0} đánh giá</p>
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
          <PenSquare className="h-4 w-4" /> Viết đánh giá cho {targetRole === "OWNER" ? "tiệm này" : "thợ này"}
        </button>
      )}

      {showForm && (
        <div className="glass-card space-y-4 rounded-2xl p-4 animate-fadeIn">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2.5 ring-1 ring-white/5">
              <span className="text-xs font-bold text-slate-300">Điểm tổng thể</span>
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
            placeholder={`Chia sẻ trải nghiệm thật của bạn với ${targetRole === "OWNER" ? "tiệm này" : "thợ này"}...`}
            className="input-field"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={submitting}
              className="flex-1 min-h-[44px] rounded-xl border border-white/10 text-sm font-bold text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-bold text-white shadow-lg shadow-pink-600/20 hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi đánh giá
            </button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Chưa có đánh giá nào" hint="Đánh giá chỉ đến từ người từng làm việc thật — hãy là người đầu tiên." />
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
                      <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/25" title="Hai bên đã thực sự kết nối trên PawNail">
                        <BadgeCheck className="h-3 w-3" /> Đã kết nối thật
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

function MediaGrid({ urls }: { urls: string[] }) {
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
function GallerySection({ ownerId }: { ownerId: string }) {
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
    return <EmptyState icon={Images} title="Chưa có ảnh tiệm" hint='Ảnh/video đăng mục "Khoe tiệm" trên bảng tin sẽ hiện ở đây.' />;
  }
  return <MediaGrid urls={media} />;
}

function ProfileSkeleton() {
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

type TabKey = "overview" | "portfolio" | "jobs" | "gallery" | "reviews";

export default function PublicProfilePage({ params }: PageProps) {
  const router = useRouter();
  const { user: viewer } = useSessionUser();
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  // Trust card — số liệu THẬT tính từ Review (không fabricate lượng khách/tip).
  const [trustSummary, setTrustSummary] = useState<ReviewSummary | null>(null);
  const [galleryCount, setGalleryCount] = useState<number | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);

  // Paywall "Mở khóa kết nối trực tiếp" — chỉ áp dụng khi Chủ tiệm xem hồ
  // sơ của Thợ (chiều ngược lại — thợ ứng tuyển job của chủ — vẫn nhắn tin
  // tự do, không gate, vì đó là hành động cốt lõi cần frictionless).
  const isOwnerViewingTechnician = viewer?.role === "OWNER" && profile?.role === "TECHNICIAN" && viewer.id !== profile.id;
  const isSelf = Boolean(viewer?.id && profile?.id && viewer.id === profile.id);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingUnlock, setCheckingUnlock] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  useEffect(() => {
    params.then((p) => setUid(p.uid));
  }, [params]);

  useEffect(() => {
    if (!uid) return;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/profile?id=${uid}`);
        if (!res.ok) throw new Error("Không tìm thấy hồ sơ này.");
        setProfile(await res.json());
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  // Số liệu tóm tắt — tải song song, độc lập với tab đang mở.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const tasks: Promise<any>[] = [fetch(`/api/reviews?targetUserId=${profile.id}`).then((r) => (r.ok ? r.json() : null))];
    if (profile.role === "OWNER") {
      tasks.push(fetch(`/api/posts?authorId=${profile.id}&postType=SHOWCASE`).then((r) => (r.ok ? r.json() : null)));
    }
    Promise.all(tasks).then(([reviewData, postData]) => {
      if (cancelled) return;
      if (reviewData) setTrustSummary(reviewData.summary);
      if (postData) setGalleryCount((postData.posts || []).reduce((sum: number, p: any) => sum + p.mediaUrls.length, 0));
    });
    return () => {
      cancelled = true;
    };
  }, [profile, statsVersion]);

  useEffect(() => {
    if (!isOwnerViewingTechnician) return;
    let cancelled = false;
    async function checkUnlock() {
      setCheckingUnlock(true);
      try {
        const res = await fetch(`/api/unlock?technicianUserId=${profile.id}`);
        const data = await res.json();
        if (!cancelled) setUnlocked(Boolean(data.unlocked));
      } catch {
        // Fail open to "locked" — nếu API lỗi thì vẫn hiện paywall thay vì
        // giả định đã mở khóa và lộ luôn quyền nhắn tin.
      } finally {
        if (!cancelled) setCheckingUnlock(false);
      }
    }
    checkUnlock();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnerViewingTechnician, profile?.id]);

  const ownerPains: string[] = viewer?.diagnosedPains ? String(viewer.diagnosedPains).split(",").filter(Boolean) : [];

  const goToChat = () => router.push(`/messages?to=${profile.id}`);

  const handleContactClick = () => {
    if (!viewer) {
      router.push("/auth/login");
      return;
    }
    if (isOwnerViewingTechnician && !unlocked) {
      setShowUnlockModal(true);
      return;
    }
    goToChat();
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile.name} · PawNail`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép liên kết hồ sơ");
    } catch {
      // Người dùng huỷ bảng chia sẻ — không cần báo lỗi.
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col text-slate-100">
        <Navbar />
        <ProfileSkeleton />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col text-slate-100">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl px-4 py-12">
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </main>
      </div>
    );
  }

  const tech = profile.technicianProfile;
  const isOwnerProfile = profile.role === "OWNER";
  const isTech = profile.role === "TECHNICIAN" && tech;
  const portfolio: string[] = tech?.portfolioImages || [];
  const specialties: string[] = tech?.specialties
    ? (Array.isArray(tech.specialties) ? tech.specialties : String(tech.specialties).split(",")).map((s: string) => s.trim()).filter(Boolean)
    : [];
  const location = [profile.city, stateName(profile.market, profile.state)].filter(Boolean).join(", ");
  const joined = profile.createdAt ? new Date(profile.createdAt) : null;
  const [g1, g2] = avatarGradient(profile.id);
  const coverImage = isTech && portfolio.find((u) => !isVideoUrl(u));
  const reviewCount = trustSummary?.count ?? 0;

  const stats = isOwnerProfile
    ? [
        { label: "Điểm uy tín", value: fmtScore(trustSummary?.avgOverall), star: true },
        { label: "Đánh giá", value: reviewCount },
        { label: "Đang tuyển", value: profile.jobs?.length ?? 0 },
        { label: "Ảnh tiệm", value: galleryCount ?? 0 },
      ]
    : [
        { label: "Điểm tay nghề", value: fmtScore(trustSummary?.avgOverall), star: true },
        { label: "Đánh giá", value: reviewCount },
        { label: "Năm nghề", value: tech?.yearsOfExperience ?? 0 },
        { label: "Mẫu portfolio", value: portfolio.length },
      ];

  const tabs: { key: TabKey; label: string; icon: typeof Star; count?: number }[] = isOwnerProfile
    ? [
        { key: "overview", label: "Tổng quan", icon: LayoutGrid },
        { key: "jobs", label: "Tin tuyển", icon: Briefcase, count: profile.jobs?.length ?? 0 },
        { key: "gallery", label: "Ảnh tiệm", icon: Images },
        { key: "reviews", label: "Đánh giá", icon: ShieldCheck, count: reviewCount },
      ]
    : [
        { key: "overview", label: "Tổng quan", icon: LayoutGrid },
        { key: "portfolio", label: "Portfolio", icon: Images, count: portfolio.length },
        { key: "reviews", label: "Đánh giá", icon: ShieldCheck, count: reviewCount },
      ];

  const primaryAction = isSelf ? (
    <Link
      href="/profile"
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-5 text-sm font-bold text-white ring-1 ring-white/10 transition-colors hover:bg-white/10"
    >
      <PenSquare className="h-4 w-4" /> Chỉnh sửa hồ sơ
    </Link>
  ) : (
    <button
      onClick={handleContactClick}
      disabled={isOwnerViewingTechnician && checkingUnlock}
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/25 transition-all hover:brightness-110 disabled:opacity-60"
    >
      {isOwnerViewingTechnician && checkingUnlock ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isOwnerViewingTechnician && !unlocked ? (
        <Lock className="h-4 w-4" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
      {isOwnerViewingTechnician && !unlocked && !checkingUnlock ? "Mở khóa liên hệ" : "Nhắn tin"}
    </button>
  );

  const shareButton = (
    <button
      onClick={handleShare}
      aria-label="Chia sẻ hồ sơ"
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-white/10 transition-colors hover:bg-white/10"
    >
      <Share2 className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl flex-1 pb-28 md:px-6 md:pb-12 md:pt-6">
        {/* ===== HEADER HỒ SƠ ===== */}
        <section className="relative overflow-hidden border-b border-white/10 bg-slate-950/60 md:rounded-3xl md:border md:shadow-2xl md:shadow-black/40">
          {/* Ảnh bìa: thợ có portfolio → dùng chính mẫu móng đẹp nhất; còn
              lại là gradient riêng theo người (cùng màu với avatar). */}
          <div className="relative h-32 overflow-hidden sm:h-44" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
            {coverImage ? (
              <Image src={coverImage} alt="" fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
            ) : (
              <>
                <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:18px_18px]" />
                <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-slate-950/80" />
          </div>

          <div className="relative px-4 pb-5 sm:px-6">
            <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
              <Avatar
                src={profile.avatarUrl}
                name={profile.name}
                seed={profile.id}
                loading="eager"
                className="h-24 w-24 shadow-xl shadow-black/50 ring-4 ring-slate-950 sm:h-28 sm:w-28"
              />
              <div className="hidden items-center gap-2 pb-1 sm:flex">
                {shareButton}
                {primaryAction}
              </div>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-[28px]">{profile.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${isOwnerProfile ? "bg-amber-500/10 text-amber-200 ring-amber-500/25" : "bg-pink-500/10 text-pink-200 ring-pink-500/25"}`}>
                {isOwnerProfile ? <Store className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isOwnerProfile ? "Chủ tiệm" : "Thợ Nail"}
              </span>
              {isTech && (tech.status === "URGENT" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-300 ring-1 ring-red-500/25">
                  <Flame className="h-3.5 w-3.5" /> Đang tìm việc gấp
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Sẵn sàng nhận việc
                </span>
              ))}
              {isOwnerProfile && profile.housingSupport && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200 ring-1 ring-sky-500/25">
                  <HomeIcon className="h-3.5 w-3.5" /> Có chỗ ở cho thợ
                </span>
              )}
            </div>

            {/* Huy hiệu — mỗi cái gắn điều kiện đo được từ dữ liệu thật (lib/badges.ts) */}
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {profile.badges.map((b: { key: keyof typeof BADGE_STYLE; label: string; hint: string }) => {
                  const st = BADGE_STYLE[b.key];
                  if (!st) return null;
                  return (
                    <span key={b.key} title={b.hint} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ring-1 ${st.cls}`}>
                      <st.icon className="h-3.5 w-3.5" /> {b.label}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-400">
              {location && (
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-500" /> {location}</span>
              )}
              {isTech && tech.yearsOfExperience > 0 && (
                <span className="inline-flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-slate-500" /> {tech.yearsOfExperience} năm kinh nghiệm</span>
              )}
              {joined && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-500" /> Tham gia {`tháng ${joined.getMonth() + 1}/${joined.getFullYear()}`}
                </span>
              )}
            </div>

            {isTech && tech.bio && <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">{tech.bio}</p>}

            {/* Nút hành động trên điện thoại: rộng hết hàng, dễ bấm */}
            <div className="mt-4 flex items-center gap-2 sm:hidden">
              <div className="flex-1 [&>*]:w-full">{primaryAction}</div>
              {shareButton}
            </div>
          </div>

          {/* Dải số liệu THẬT (đánh giá, tin tuyển, ảnh…) — không bịa lượng khách/tip */}
          <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5 bg-white/[0.015]">
            {stats.map((s) => (
              <div key={s.label} className="px-1 py-3.5 text-center">
                <p className="flex items-center justify-center gap-1 text-lg font-black text-white">
                  {s.value}
                  {s.star && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {showUnlockModal && (
          <UnlockChatModal
            technicianUserId={profile.id}
            technicianName={profile.name}
            ownerPains={ownerPains}
            onClose={() => setShowUnlockModal(false)}
            onUnlocked={() => {
              setUnlocked(true);
              setShowUnlockModal(false);
              goToChat();
            }}
          />
        )}

        {/* ===== TABS ===== */}
        <nav
          aria-label="Mục hồ sơ"
          className="sticky top-16 z-20 mt-0 flex gap-1 border-b border-white/10 bg-slate-950/85 px-2 backdrop-blur-md md:mt-4 md:rounded-2xl md:border md:px-1.5 md:py-1.5"
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap py-3 text-[13px] font-bold transition-colors md:rounded-xl md:py-2.5 ${
                  active ? "text-white md:bg-white/[0.07]" : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {/* 4 tab trên điện thoại hẹp: bỏ icon để chữ không bị xuống dòng */}
                <t.icon className={`h-4 w-4 ${tabs.length > 3 ? "hidden sm:block" : ""}`} />
                <span>{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-pink-500/20 text-pink-200" : "bg-white/5 text-slate-400"}`}>{t.count}</span>
                )}
                {active && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 md:hidden" />}
              </button>
            );
          })}
        </nav>

        <div className="space-y-5 px-4 pt-5 md:px-0">
          {/* ---------- THỢ ---------- */}
          {isTech && tab === "overview" && (
            <>
              {/* "Hộ Chiếu Tay Nghề" — điểm từ Chủ tiệm cũ + thời gian gắn bó
                  trung bình (tự khai báo — không có bảng chấm công thật). */}
              <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/50 via-slate-900/50 to-slate-950/50 p-5">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
                <SectionTitle icon={Award} tone="text-indigo-300">Hộ chiếu tay nghề</SectionTitle>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {[
                    { v: fmtScore(trustSummary?.avgOverall), l: "Điểm từ chủ tiệm", star: true },
                    { v: reviewCount, l: "Lượt đánh giá" },
                    { v: tech.avgTenureMonths ? `~${tech.avgTenureMonths}` : "—", l: "Tháng / tiệm" },
                  ].map((x) => (
                    <div key={x.l} className="rounded-xl bg-slate-950/50 p-3 text-center ring-1 ring-white/5">
                      <p className="flex items-center justify-center gap-1 text-lg font-black text-white">
                        {x.v} {x.star && <Star className="h-3.5 w-3.5 fill-indigo-300 text-indigo-300" />}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{x.l}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card space-y-3 rounded-2xl p-5">
                <SectionTitle icon={Sparkles}>Kỹ năng sở trường</SectionTitle>
                {specialties.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((s) => (
                      <span key={s} className="rounded-full bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-200 ring-1 ring-pink-500/25">{s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Thợ chưa cập nhật kỹ năng.</p>
                )}
              </div>

              {portfolio.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <SectionTitle icon={Images}>Mẫu móng gần đây</SectionTitle>
                    {portfolio.length > 6 && (
                      <button onClick={() => setTab("portfolio")} className="flex items-center text-xs font-bold text-pink-300 hover:text-pink-200">
                        Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <MediaGrid urls={portfolio.slice(0, 6)} />
                </div>
              )}
            </>
          )}

          {isTech && tab === "portfolio" && (
            portfolio.length > 0
              ? <MediaGrid urls={portfolio} />
              : <EmptyState icon={Images} title="Chưa có mẫu móng nào" hint="Thợ chưa đăng ảnh/video portfolio." />
          )}

          {isTech && tab === "reviews" && (
            <ReviewsSection
              targetUserId={profile.id}
              targetRole="TECHNICIAN"
              viewerId={viewer?.id ?? null}
              viewerRole={viewer?.role ?? null}
              onChanged={() => setStatsVersion((v) => v + 1)}
            />
          )}

          {/* ---------- CHỦ TIỆM ---------- */}
          {isOwnerProfile && tab === "overview" && (
            <>
              {/* "Sức Khỏe Tiệm & Văn Hóa Làm Việc" — 3 tiêu chí do Thợ từng
                  làm chấm + chính sách tiệm tự khai ("Chưa cập nhật" thay vì
                  bịa mặc định). */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-slate-900/50 to-slate-950/50 p-5">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
                <SectionTitle icon={HeartHandshake} tone="text-emerald-300">Sức khỏe tiệm &amp; văn hóa làm việc</SectionTitle>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    { label: "Tổng thể", value: trustSummary?.avgOverall },
                    { label: "Sòng phẳng", value: trustSummary?.avgPunctualityOrPay },
                    { label: "Môi trường", value: trustSummary?.avgEnvironment },
                    { label: "Chia turn", value: trustSummary?.avgTurnFairness },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-slate-950/50 p-2.5 text-center ring-1 ring-white/5">
                      <p className="text-lg font-black text-emerald-300">{fmtScore(item.value)}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">Chấm bởi thợ từng làm tại tiệm · {reviewCount} lượt</p>
              </div>

              <div className="glass-card divide-y divide-white/5 rounded-2xl">
                <div className="p-5 pb-3"><SectionTitle icon={Store}>Chính sách tiệm</SectionTitle></div>
                {[
                  { icon: Users2, label: "Chia turn", value: profile.turnSplitPolicy },
                  { icon: DollarSign, label: "Loại khách", value: profile.clientTypePolicy },
                  { icon: HomeIcon, label: "Chỗ ở cho thợ xa", value: profile.housingSupport ? "Có hỗ trợ" : "Không" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/5">
                      <row.icon className="h-4 w-4 text-slate-400" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                      <p className={`text-sm ${row.value ? "font-semibold text-slate-100" : "italic text-slate-500"}`}>{row.value || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                ))}
              </div>

              {(profile.jobs?.length ?? 0) > 0 && (
                <button
                  onClick={() => setTab("jobs")}
                  className="glass-card flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:border-pink-500/30"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/25">
                    <Briefcase className="h-5 w-5 text-pink-300" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-white">{profile.jobs.length} tin đang tuyển</span>
                    <span className="block text-xs text-slate-500">Xem vị trí & mức lương</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
              )}
            </>
          )}

          {isOwnerProfile && tab === "jobs" && (
            (!profile.jobs || profile.jobs.length === 0) ? (
              <EmptyState icon={Briefcase} title="Chưa có tin tuyển dụng" hint="Tiệm hiện không đăng tin tuyển nào." />
            ) : (
              <div className="space-y-2.5">
                {profile.jobs.map((job: any) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="glass-card group flex items-center gap-3 rounded-2xl p-4 transition-colors hover:border-pink-500/30"
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-fuchsia-500/10 ring-1 ring-pink-500/20">
                      <Briefcase className="h-5 w-5 text-pink-300" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-100 group-hover:text-white">{job.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                        <MapPin className="h-3 w-3" /> {job.city}, {stateName(job.market, job.state)}
                      </p>
                    </div>
                    {job.salaryAmount && (
                      <span className="flex-shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/20">
                        {job.salaryAmount}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-600 group-hover:text-slate-300" />
                  </Link>
                ))}
              </div>
            )
          )}

          {isOwnerProfile && tab === "gallery" && <GallerySection ownerId={profile.id} />}
          {isOwnerProfile && tab === "reviews" && (
            <ReviewsSection
              targetUserId={profile.id}
              targetRole="OWNER"
              viewerId={viewer?.id ?? null}
              viewerRole={viewer?.role ?? null}
              onChanged={() => setStatsVersion((v) => v + 1)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
