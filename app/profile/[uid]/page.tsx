"use client";

import React, { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import {
  Loader2, AlertCircle, MessageCircle, Flame, CheckCircle2, MapPin, Briefcase, Play, Lock,
  Star, Images, ShieldCheck, Send, BadgeCheck, HeartHandshake, Home as HomeIcon, Users2, Award,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useSessionUser } from "@/lib/SessionUserContext";
import UnlockChatModal from "@/components/profile/UnlockChatModal";

interface PageProps {
  params: Promise<{ uid: string }>;
}

const AVATAR_FALLBACK = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ec4899&color=ffffff&bold=true&format=png`;

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
}: {
  targetUserId: string;
  targetRole: "OWNER" | "TECHNICIAN";
  viewerId: string | null;
  viewerRole: string | null;
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
    } catch {
      toast.error("Lỗi mạng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-pink-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Tóm tắt điểm trung bình theo từng tiêu chí */}
      <div className="grid grid-cols-3 gap-2">
        {criteria.map((c) => (
          <div key={c.key} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-3 text-center">
            <p className="text-lg font-black text-amber-400">{summary?.[SUMMARY_KEY_FOR[c.key]] ?? "—"}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{c.summaryLabel}</p>
          </div>
        ))}
      </div>

      {canReview && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full min-h-[48px] rounded-2xl border-2 border-dashed border-slate-700 text-sm font-bold text-slate-300 hover:border-pink-500/50 hover:text-pink-300 transition-all"
        >
          ✍️ Viết đánh giá cho {targetRole === "OWNER" ? "tiệm này" : "thợ này"}
        </button>
      )}

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2.5">
              <span className="text-xs font-bold text-slate-300">Điểm tổng thể</span>
              <StarPicker value={overall} onChange={setOverall} />
            </div>
            {criteria.map((c) => (
              <div key={c.key} className="flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2.5">
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
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={submitting}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-800 text-sm font-bold text-slate-300 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi đánh giá
            </button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">Chưa có đánh giá nào — hãy là người đầu tiên chia sẻ trải nghiệm.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-850 bg-slate-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2.5">
                <img src={r.author.avatarUrl || AVATAR_FALLBACK(r.author.name)} alt={r.author.name} className="h-8 w-8 rounded-full object-cover border border-slate-800" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-200 truncate">{r.author.name}</p>
                    {r.isVerifiedConnection && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 flex-shrink-0">
                        <BadgeCheck className="h-2.5 w-2.5" /> Verified Connection
                      </span>
                    )}
                  </div>
                  <StarPicker value={r.overall} readOnly size="h-3 w-3" />
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{r.comment}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {criteria.map((c) => (
                  <span key={c.key} className="text-[10px] rounded-full bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-400">
                    {c.summaryLabel} {r[c.key]}★
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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

  const media = (posts || []).flatMap((p) => p.mediaUrls);

  if (posts === null) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-pink-500 animate-spin" /></div>;
  }

  if (media.length === 0) {
    return (
      <div className="text-center py-10 space-y-2">
        <Images className="h-8 w-8 text-slate-700 mx-auto" />
        <p className="text-xs text-slate-500">Tiệm chưa đăng ảnh/video "Khoe tiệm" nào trên bảng tin.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {media.map((url, idx) => (
        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
          {isVideoUrl(url) ? (
            <>
              <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              <Play className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />
            </>
          ) : (
            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function PublicProfilePage({ params }: PageProps) {
  const router = useRouter();
  const { user: viewer } = useSessionUser();
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"overview" | "gallery" | "reviews">("overview");

  // Trust card — số liệu THẬT tính từ Review (không fabricate lượng khách/tip).
  const [trustSummary, setTrustSummary] = useState<ReviewSummary | null>(null);
  const [galleryCount, setGalleryCount] = useState<number | null>(null);

  // Paywall "Mở khóa kết nối trực tiếp" — chỉ áp dụng khi Chủ tiệm xem hồ
  // sơ của Thợ (chiều ngược lại — thợ ứng tuyển job của chủ — vẫn nhắn tin
  // tự do, không gate, vì đó là hành động cốt lõi cần frictionless).
  const isOwnerViewingTechnician = viewer?.role === "OWNER" && profile?.role === "TECHNICIAN" && viewer.id !== profile.id;
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

  // Số liệu thẻ tóm tắt "Trust Passport" — tải song song, độc lập với việc
  // người xem có bấm vào tab Gallery/Đánh giá hay không. Áp dụng cho cả 2
  // vai trò (trước đây chỉ OWNER có, giờ TECHNICIAN cũng cần cho "Hộ Chiếu
  // Tay Nghề").
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
  }, [profile]);

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
    if (isOwnerViewingTechnician && !unlocked) {
      setShowUnlockModal(true);
      return;
    }
    goToChat();
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 text-pink-500 animate-spin" /></main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto max-w-2xl w-full px-4 py-12">
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </main>
      </div>
    );
  }

  const tech = profile.technicianProfile;
  const isOwnerProfile = profile.role === "OWNER";

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-2xl px-4 py-8 pb-24 md:pb-8 space-y-6">
        <div className="flex items-center gap-4">
          <img src={profile.avatarUrl} alt={profile.name} className="h-20 w-20 rounded-full object-cover border-2 border-pink-500/50" />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-white truncate">{profile.name}</h1>
            <p className="text-xs text-slate-400">{profile.role === "OWNER" ? "🏪 Chủ tiệm" : "💅 Thợ Nail"}</p>
            {(profile.city || profile.state) && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {[profile.city, profile.state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Thẻ tóm tắt "sức khỏe tiệm" — chỉ số liệu THẬT tính được từ hệ
            thống (điểm đánh giá trung bình, số lượt đánh giá, số ảnh gallery,
            số tin đang tuyển) — cố tình không hiển thị "lượng khách/ngày" hay
            "tỉ lệ tip cao" vì không có nguồn dữ liệu POS/booking thật nào để
            tính, tránh bịa số liệu trông như thật. */}
        {isOwnerProfile && (
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <p className="text-lg font-black text-amber-400 flex items-center justify-center gap-1">
                {trustSummary?.avgOverall ?? "—"} <Star className="h-4 w-4 fill-amber-400" />
              </p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Điểm uy tín</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-3 text-center">
              <p className="text-lg font-black text-white">{trustSummary?.count ?? 0}</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Đánh giá</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-3 text-center">
              <p className="text-lg font-black text-white">{galleryCount ?? 0}</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Ảnh Gallery</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-3 text-center">
              <p className="text-lg font-black text-white">{profile.jobs?.length ?? 0}</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Đang tuyển</p>
            </div>
          </div>
        )}

        {/* "Sức Khỏe Tiệm & Văn Hóa Làm Việc" — thẻ tín nhiệm cho Chủ tiệm:
            3 tiêu chí minh bạch (chấm bởi Thợ từng làm) + chính sách tiệm tự
            khai báo. Chính sách hiển thị "Chưa cập nhật" thay vì bịa mặc
            định, vì đây là dữ liệu chủ tiệm phải tự nhập, không suy ra được. */}
        {isOwnerProfile && (
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-slate-900/30 to-slate-900/30 p-4 space-y-3.5">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-emerald-400" /> Sức Khỏe Tiệm &amp; Văn Hóa Làm Việc
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Tổng thể", value: trustSummary?.avgOverall },
                { label: "Sòng phẳng", value: trustSummary?.avgPunctualityOrPay },
                { label: "Môi trường", value: trustSummary?.avgEnvironment },
                { label: "Chia turn", value: trustSummary?.avgTurnFairness },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-950/40 border border-slate-800 p-2.5 text-center">
                  <p className="text-base font-black text-emerald-400">{item.value ?? "—"}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-2 text-xs">
                <Users2 className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-slate-500">Chia turn:</span>
                <span className="text-slate-200 font-semibold">{profile.turnSplitPolicy || "Chưa cập nhật"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Users2 className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-slate-500">Loại khách:</span>
                <span className="text-slate-200 font-semibold">{profile.clientTypePolicy || "Chưa cập nhật"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <HomeIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-slate-500">Chỗ ở cho thợ xa:</span>
                <span className="text-slate-200 font-semibold">{profile.housingSupport ? "Có" : "Không"}</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleContactClick}
          disabled={isOwnerViewingTechnician && checkingUnlock}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-500 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-600/25 transition-all disabled:opacity-60"
        >
          {isOwnerViewingTechnician && checkingUnlock ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isOwnerViewingTechnician && !unlocked ? (
            <Lock className="h-5 w-5" />
          ) : (
            <MessageCircle className="h-5 w-5" />
          )}
          {isOwnerViewingTechnician && !unlocked && !checkingUnlock
            ? "Mở khóa liên hệ trực tiếp"
            : `Nhắn tin ${profile.role === "TECHNICIAN" ? "tuyển dụng" : "liên hệ"}`}
        </button>

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

        {/* Technician portfolio */}
        {profile.role === "TECHNICIAN" && tech && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {tech.status === "URGENT" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400 border border-red-500/30">
                  <Flame className="h-3.5 w-3.5" /> Đang tìm việc gấp
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Đang rảnh tay
                </span>
              )}
              <span className="text-xs text-slate-400">{tech.yearsOfExperience} năm kinh nghiệm</span>
            </div>

            {tech.bio && <p className="text-sm text-slate-300 leading-relaxed">{tech.bio}</p>}

            {tech.specialties?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(tech.specialties) ? tech.specialties : tech.specialties.split(",")).filter(Boolean).map((s: string) => (
                  <span key={s} className="rounded-full bg-pink-500/10 border border-pink-500/25 px-3 py-1 text-xs font-semibold text-pink-300">{s}</span>
                ))}
              </div>
            )}

            {/* "Hộ Chiếu Tay Nghề" — thẻ tín nhiệm cho Thợ: điểm đánh giá từ
                Chủ tiệm cũ + kỹ năng thế mạnh + thời gian gắn bó trung bình
                (tự khai báo — hệ thống không có bảng chấm công/lịch sử làm
                việc thật nào để tự tính con số này). */}
            <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 via-slate-900/30 to-slate-900/30 p-4 space-y-3.5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Award className="h-4 w-4 text-indigo-400" /> Hộ Chiếu Tay Nghề
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-2.5 text-center">
                  <p className="text-base font-black text-indigo-400 flex items-center justify-center gap-1">
                    {trustSummary?.avgOverall ?? "—"} <Star className="h-3.5 w-3.5 fill-indigo-400" />
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Điểm từ Chủ tiệm</p>
                </div>
                <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-2.5 text-center">
                  <p className="text-base font-black text-white">{trustSummary?.count ?? 0}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Lượt đánh giá</p>
                </div>
                <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-2.5 text-center">
                  <p className="text-base font-black text-white">
                    {tech.avgTenureMonths ? `~${tech.avgTenureMonths}` : "—"}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Tháng/tiệm (TB)</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-2">Portfolio ({tech.portfolioImages?.length || 0})</h3>
              {tech.portfolioImages?.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {tech.portfolioImages.map((url: string, idx: number) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800">
                      {isVideoUrl(url) ? (
                        <>
                          <video src={url} className="h-full w-full object-cover" muted playsInline />
                          <Play className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />
                        </>
                      ) : (
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Thợ chưa đăng ảnh portfolio nào.</p>
              )}
            </div>

            {/* Nhận xét thực tế từ Chủ tiệm — chiều TECHNICIAN_REVIEW. */}
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-400" /> Đánh giá từ Chủ tiệm
              </h3>
              <ReviewsSection
                targetUserId={profile.id}
                targetRole="TECHNICIAN"
                viewerId={viewer?.id ?? null}
                viewerRole={viewer?.role ?? null}
              />
            </div>
          </div>
        )}

        {/* Owner: Tổng quan / Gallery / Đánh giá */}
        {isOwnerProfile && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-900/40 border border-slate-850">
              <button
                onClick={() => setSubTab("overview")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${subTab === "overview" ? "bg-pink-600 text-white" : "text-slate-400"}`}
              >
                <Briefcase className="h-3.5 w-3.5" /> Tin tuyển
              </button>
              <button
                onClick={() => setSubTab("gallery")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${subTab === "gallery" ? "bg-pink-600 text-white" : "text-slate-400"}`}
              >
                <Images className="h-3.5 w-3.5" /> Gallery
              </button>
              <button
                onClick={() => setSubTab("reviews")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${subTab === "reviews" ? "bg-pink-600 text-white" : "text-slate-400"}`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Đánh giá
              </button>
            </div>

            {subTab === "overview" && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-pink-400" /> Tin tuyển dụng đang đăng
                </h3>
                {(!profile.jobs || profile.jobs.length === 0) ? (
                  <p className="text-xs text-slate-500">Chưa có tin tuyển dụng nào.</p>
                ) : (
                  <div className="space-y-2">
                    {profile.jobs.map((job: any) => (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="block rounded-xl border border-slate-850 bg-slate-950/40 px-3.5 py-2.5 hover:border-pink-500/40 transition-colors"
                      >
                        <p className="text-sm font-bold text-slate-200">{job.title}</p>
                        <p className="text-xs text-slate-500">{job.city}, {job.state} · {job.salaryAmount}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {subTab === "gallery" && <GallerySection ownerId={profile.id} />}
            {subTab === "reviews" && (
              <ReviewsSection
                targetUserId={profile.id}
                targetRole="OWNER"
                viewerId={viewer?.id ?? null}
                viewerRole={viewer?.role ?? null}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
