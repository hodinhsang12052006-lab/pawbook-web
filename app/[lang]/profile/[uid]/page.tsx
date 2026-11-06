"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import {
  Loader2, AlertCircle, MessageCircle, MapPin, Briefcase, Star, Images, ShieldCheck, BadgeCheck, HeartHandshake, Home as HomeIcon, Users2, Award, Store, Sparkles, CalendarDays, Share2, PenSquare, ChevronRight, LayoutGrid, DollarSign, Crown, Zap, Heart, Megaphone, BookOpen,
  CalendarCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useSessionUser } from "@/lib/SessionUserContext";
import Avatar from "@/components/ui/Avatar";
import OfficialProfile from "@/components/profile/OfficialProfile";
import ShareCardButton from "@/components/profile/ShareCard";
import NailMenu from "@/components/menu/NailMenu";
import { stateName, placeLabel } from "@/lib/stateNames";

interface PageProps {
  params: Promise<{ uid: string }>;
}
import { isVideoUrl, ReviewSummary, fmtScore, SectionTitle, EmptyState, ReviewsSection, MediaGrid, GallerySection, ProfileSkeleton } from "@/components/profile/ProfileSections";
import { currentLocale, tr } from "@/lib/i18n/tr";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { detectTextLang } from "@/lib/i18n/detectLang";
import ClientReviews from "@/components/booking/ClientReviews";
import { useTr } from "@/lib/i18n/useTr";
import { dt } from "@/lib/i18n/dataEn";

const BADGE_STYLE = {
  founding: { icon: Crown, cls: "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-200 ring-amber-400/40" },
  fast_reply: { icon: Zap, cls: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30" },
  top_rated: { icon: Star, cls: "bg-amber-500/10 text-amber-200 ring-amber-500/30" },
  complete: { icon: BadgeCheck, cls: "bg-sky-500/10 text-sky-200 ring-sky-500/30" },
  loved: { icon: Heart, cls: "bg-pink-500/10 text-pink-200 ring-pink-500/30" },
  ambassador: { icon: Megaphone, cls: "bg-fuchsia-500/15 text-fuchsia-200 ring-fuchsia-400/40" },
} as const;

type TabKey = "overview" | "menu" | "portfolio" | "jobs" | "gallery" | "reviews" | "pros";

export default function PublicProfilePage({ params }: PageProps) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const { user: viewer } = useSessionUser();
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  // ?tab=menu (link chia sẻ / QR) mở thẳng tab đó
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "menu" || t === "portfolio" || t === "jobs" || t === "gallery" || t === "reviews" || t === "pros") setTab(t);
  }, []);

  // Trust card — số liệu THẬT tính từ Review (không fabricate lượng khách/tip).
  const [trustSummary, setTrustSummary] = useState<ReviewSummary | null>(null);
  const [galleryCount, setGalleryCount] = useState<number | null>(null);
  // Số mẫu đang hiện trong Menu — 0 thì ẩn tab Menu với khách (chủ hồ sơ vẫn thấy để tạo menu).
  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);

  // Paywall "Mở khóa kết nối trực tiếp" — chỉ áp dụng khi Chủ tiệm xem hồ
  // sơ của Thợ (chiều ngược lại — thợ ứng tuyển job của chủ — vẫn nhắn tin
  // tự do, không gate, vì đó là hành động cốt lõi cần frictionless).
  const isOwnerViewingTechnician = viewer?.role === "OWNER" && profile?.role === "TECHNICIAN" && viewer.id !== profile.id;
  const isSelf = Boolean(viewer?.id && profile?.id && viewer.id === profile.id);
  useEffect(() => {
    if (tab === "menu" && menuCount === 0 && !isSelf) setTab("overview");
  }, [tab, menuCount, isSelf]);
  // KHÁCH đi làm nail xem hồ sơ tiệm/thợ: cần menu + giá + đánh giá + đặt lịch — không cần chuyện tuyển dụng
  // ("Đang tìm việc gấp", "Có chỗ ở cho thợ", tab Tin tuyển). Có menu → mở thẳng tab Menu.
  const viewerIsClient = viewer?.role === "CLIENT";
  // Khách chưa đăng nhập cũng xem như khách làm nail (đa số đến từ link menu / Google): trang của TIỆM, không
  // phải trang tuyển dụng. Thợ chưa đăng nhập vẫn mở được tab "Dành cho thợ" (môi trường làm việc + tin tuyển).
  const guestViewer = !viewer;
  const clientView = guestViewer || viewerIsClient;
  useEffect(() => {
    if (clientView && (menuCount ?? 0) > 0 && tab === "overview") setTab("menu");
  }, [clientView, menuCount]); // eslint-disable-line react-hooks/exhaustive-deps
  // Đánh giá của KHÁCH đã đặt lịch (khách tin cái này, không phải điểm chủ tiệm chấm thợ).
  const [clientStats, setClientStats] = useState<{ average: number | null; count: number } | null>(null);
  const [bioOriginal, setBioOriginal] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingUnlock, setCheckingUnlock] = useState(false);

  useEffect(() => {
    params.then((p) => setUid(p.uid));
  }, [params]);

  useEffect(() => {
    if (!uid) return;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/profile?id=${uid}&badges=1`);
        if (!res.ok) throw new Error(tr("Không tìm thấy hồ sơ này.", "Profile not found."));
        setProfile(await res.json());
      } catch (err: any) {
        setError(err.message || tr("Đã xảy ra lỗi.", "Something went wrong."));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  // "Ai đã xem hồ sơ bạn": ghi 1 lượt khi người đã đăng nhập mở hồ sơ NGƯỜI KHÁC.
  useEffect(() => {
    if (!viewer?.id || !profile?.id || viewer.id === profile.id) return;
    fetch("/api/profile/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: profile.id }) }).catch(() => {});
  }, [viewer?.id, profile?.id]);

  // Số liệu tóm tắt — tải song song, độc lập với tab đang mở.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const tasks: Promise<any>[] = [fetch(`/api/reviews?targetUserId=${profile.id}`).then((r) => (r.ok ? r.json() : null))];
    if (profile.role === "OWNER") {
      tasks.push(fetch(`/api/posts?authorId=${profile.id}&postType=SHOWCASE`).then((r) => (r.ok ? r.json() : null)));
    }
    if (profile.role === "OWNER" || profile.role === "TECHNICIAN") {
      fetch(`/api/client-reviews?techId=${encodeURIComponent(profile.id)}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!cancelled) setClientStats(d ? { average: d.average ?? null, count: d.count ?? 0 } : { average: null, count: 0 });
      }).catch(() => {});
      fetch(`/api/menu?userId=${profile.id}`).then((r) => (r.ok ? r.json() : null)).then((m) => {
        if (!cancelled) setMenuCount(m ? (m.items || []).filter((i: { active: boolean }) => i.active).length : 0);
      }).catch(() => { if (!cancelled) setMenuCount(0); });
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


  const goToChat = () => router.push(`/messages?to=${profile.id}`);

  const handleContactClick = () => {
    if (!viewer) {
      router.push("/auth/login");
      return;
    }
    // Chủ tiệm nhắn thợ NGAY — không còn "mở khoá"/khảo sát chặn giữa chừng
    // (đúng lúc họ cần nhất). Vẫn ghi bản ghi kết nối ở nền vì đánh giá 2
    // chiều dựa vào nó ("Đã kết nối thật").
    if (isOwnerViewingTechnician && !unlocked) {
      setUnlocked(true);
      fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ technicianUserId: profile.id }) }).catch(() => {});
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
      toast.success(tr("Đã sao chép liên kết hồ sơ", "Profile link copied"));
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

  // Tài khoản chính thức (ADMIN, tick xanh) có giao diện hồ sơ riêng.
  if (profile.role === "ADMIN") {
    return (
      <div className="flex min-h-screen flex-col text-slate-100">
        <Navbar />
        <OfficialProfile profile={profile} isSelf={isSelf} />
      </div>
    );
  }

  // Khách đi làm nail: không có hồ sơ nghề công khai — chỉ thẻ gọn + nút nhắn (tiệm mở từ tin nhắn).
  if (profile.role === "CLIENT") {
    return (
      <div className="flex min-h-screen flex-col text-slate-100">
        <Navbar />
        <main className="mx-auto w-full max-w-md px-4 py-10">
          <div className="rounded-3xl bg-white/[0.04] p-6 text-center ring-1 ring-white/10">
            <Avatar src={profile.avatarUrl} name={profile.name} seed={profile.id} className="mx-auto h-20 w-20" />
            <p className="mt-3 text-lg font-black text-white">{profile.name}</p>
            <p className="text-sm text-slate-400">{tr("Khách PawNail", "PawNail client")}{profile.city ? ` · ${profile.city}` : ""}</p>
            {!isSelf && <Link href={`/messages?to=${profile.id}`} className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 text-sm font-black text-white">{tr("Nhắn tin", "Message")}</Link>}
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
  // Tiệm: tiêu đề là TÊN TIỆM ("Luxe Nails & Spa" — trùng với trang menu), tên chủ tiệm ở dòng phụ.
  // Cùng quy tắc với /menu, /salons, "Lịch hẹn của tôi": tên tiệm của tin ĐẦU TIÊN tiệm đăng (API trả tin mới nhất trước
  // → lấy từ cuối danh sách). Trước đây lấy tin mới nhất: đăng 1 tin tên khác là tiêu đề hồ sơ lệch với trang menu.
  const salonName: string | null = isOwnerProfile ? ([...(profile.jobs ?? [])].reverse().find((j: { salonName?: string }) => j.salonName?.trim())?.salonName?.trim() ?? null) : null;
  const headline = salonName || profile.name;
  const years = tech?.yearsOfExperience ?? 0;
  // Giới thiệu theo ngôn ngữ người xem (bản dịch máy chủ lưu đệm) + "Xem bản gốc".
  const bioRaw: string = tech?.bio || "";
  const bioTr: string | null = !isSelf ? (tech?.bioTx?.[currentLocale()] ?? null) : null;
  const bioShown = bioTr && !bioOriginal ? bioTr : bioRaw;
  const joined = profile.createdAt ? new Date(profile.createdAt) : null;
  const coverImage = isTech && portfolio.find((u) => !isVideoUrl(u));
  const reviewCount = trustSummary?.count ?? 0;

  const clientRating = clientStats?.average != null ? clientStats.average.toFixed(1) : "—";
  const stats = clientView
    ? [
        { label: tr("Đánh giá khách", "Client rating"), value: clientRating, star: true },
        { label: tr("Lượt đánh giá", "Reviews"), value: clientStats?.count ?? 0 },
        { label: tr("Dịch vụ", "Services"), value: menuCount ?? 0 },
        isOwnerProfile ? { label: tr("Ảnh tiệm", "Salon photos"), value: galleryCount ?? 0 } : { label: tr("Ảnh tác phẩm", "Portfolio"), value: portfolio.length },
      ]
    : isOwnerProfile
    ? [
        { label: tr("Điểm uy tín", "Trust score"), value: fmtScore(trustSummary?.avgOverall), star: true },
        { label: tr("Đánh giá", "Reviews"), value: reviewCount },
        ...(viewerIsClient ? [] : [{ label: tr("Đang tuyển", "Hiring"), value: profile.jobs?.length ?? 0 }]),
        { label: tr("Ảnh tiệm", "Salon photos"), value: galleryCount ?? 0 },
      ]
    : [
        { label: tr("Điểm tay nghề", "Skill score"), value: fmtScore(trustSummary?.avgOverall), star: true },
        { label: tr("Đánh giá", "Reviews"), value: reviewCount },
        { label: tr("Năm nghề", "Years"), value: tech?.yearsOfExperience ?? 0 },
        { label: tr("Ảnh tác phẩm", "Portfolio"), value: portfolio.length },
      ];

  const reviewsTabCount = clientView ? clientStats?.count ?? 0 : reviewCount;
  const allTabs: { key: TabKey; label: string; icon: typeof Star; count?: number }[] = isOwnerProfile
    ? [
        { key: "overview", label: tr("Tổng quan", "Overview"), icon: LayoutGrid },
        { key: "menu", label: "Menu", icon: BookOpen, count: menuCount ?? 0 },
        ...(clientView ? [] : [{ key: "jobs" as TabKey, label: tr("Tin tuyển", "Jobs"), icon: Briefcase, count: profile.jobs?.length ?? 0 }]),
        { key: "gallery", label: tr("Ảnh tiệm", "Salon photos"), icon: Images },
        { key: "reviews", label: tr("Đánh giá", "Reviews"), icon: ShieldCheck, count: reviewsTabCount },
        // Khách CHƯA đăng nhập có thể là thợ đang tìm việc: môi trường làm việc + tin tuyển ở 1 tab riêng.
        ...(guestViewer ? [{ key: "pros" as TabKey, label: tr("Dành cho thợ", "For nail techs"), icon: Briefcase, count: profile.jobs?.length ?? 0 }] : []),
      ]
    : [
        { key: "overview", label: tr("Tổng quan", "Overview"), icon: LayoutGrid },
        { key: "menu", label: "Menu", icon: BookOpen, count: menuCount ?? 0 },
        { key: "portfolio", label: tr("Tác phẩm", "Portfolio"), icon: Images, count: portfolio.length },
        { key: "reviews", label: tr("Đánh giá", "Reviews"), icon: ShieldCheck, count: reviewsTabCount },
      ];
  // Khách chỉ thấy tab Menu khi đã có mẫu (tránh "Chưa có mẫu nào" ở mọi hồ sơ mới).
  const tabs = allTabs.filter((t) => t.key !== "menu" || isSelf || (menuCount ?? 0) > 0);

  const primaryAction = clientView && !isSelf && (menuCount ?? 0) > 0 ? (
    <div className="flex gap-2">
      <Link href={`/menu/${profile.id}`} className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/25">
        <CalendarCheck className="h-4 w-4" />{tr("Đặt lịch", "Book")}
      </Link>
      <button onClick={handleContactClick} className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-white/10">
        <MessageCircle className="h-4 w-4" />{tr("Nhắn hỏi mẫu", "Message")}
      </button>
    </div>
  ) : isSelf ? (
    <Link
      href="/profile"
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-5 text-sm font-bold text-white ring-1 ring-white/10 transition-colors hover:bg-white/10"
    >
      <PenSquare className="h-4 w-4" />{tr(" Chỉnh sửa hồ sơ", " Edit profile")}
    </Link>
  ) : (
    <button
      onClick={handleContactClick}
      disabled={isOwnerViewingTechnician && checkingUnlock}
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/25 transition-all hover:brightness-110 disabled:opacity-60"
    >
      {isOwnerViewingTechnician && checkingUnlock ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
      {tr("Nhắn tin", "Message")}
    </button>
  );

  const shareButton = (
    <button
      onClick={handleShare}
      aria-label={tr("Chia sẻ hồ sơ", "Share profile")}
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
          <div className={`relative h-32 overflow-hidden sm:h-44 ${coverImage ? "bg-pn-raised" : "border-b border-pn-line bg-pn-raised"}`}>
            {coverImage ? (
              <Image src={coverImage} alt="" fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
            ) : (
              <>
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

            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-[28px]">{headline}</h1>
            {salonName && salonName !== profile.name && <p className="mt-0.5 text-sm text-slate-400">{tr(`Chủ tiệm: ${profile.name}`, `Owner: ${profile.name}`)}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${isOwnerProfile ? "bg-amber-500/10 text-amber-200 ring-amber-500/25" : "bg-pink-500/10 text-pink-200 ring-pink-500/25"}`}>
                {isOwnerProfile ? <Store className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isOwnerProfile ? (clientView ? tr("Tiệm nail", "Nail salon") : tr("Chủ tiệm", "Salon owner")) : tr("Thợ nail", "Nail tech")}
              </span>
              {isTech && !clientView && (tech.status === "URGENT" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{tr(" Sẵn sàng nhận việc ngay", " Available now")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{tr(" Sẵn sàng nhận việc", " Open to work")}
                </span>
              ))}
              {isOwnerProfile && profile.housingSupport && !clientView && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200 ring-1 ring-sky-500/25">
                  <HomeIcon className="h-3.5 w-3.5" />{tr(" Có chỗ ở cho thợ", " Housing for techs")}
                </span>
              )}
              {profile.phoneVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200 ring-1 ring-emerald-500/25" title={tr("Đã xác minh số điện thoại bằng mã SMS", "Phone number verified by SMS code")}>
                  <BadgeCheck className="h-3.5 w-3.5" />{tr(" SĐT đã xác minh", " Phone verified")}
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
                    <span key={b.key} title={dt(b.hint)} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ring-1 ${st.cls}`}>
                      <st.icon className="h-3.5 w-3.5" /> {dt(b.label)}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-400">
              {location && (
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-500" /> {location}</span>
              )}
              {isTech && years > 0 && (
                <span className="inline-flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-slate-500" /> {years}{tr(" năm kinh nghiệm", years === 1 ? " year of experience" : " years of experience")}</span>
              )}
              {joined && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-500" /> {tr(`Tham gia tháng ${joined.getMonth() + 1}/${joined.getFullYear()}`, `Joined ${joined.getMonth() + 1}/${joined.getFullYear()}`)}
                </span>
              )}
            </div>

            {isTech && bioRaw && (
              <div className="mt-3 max-w-xl">
                <p className="text-sm leading-relaxed text-slate-300" lang={detectTextLang(bioShown) ?? undefined}>{bioShown}</p>
                {bioTr && (
                  <button type="button" onClick={() => setBioOriginal((o) => !o)} className="mt-1 text-[11px] font-semibold text-sky-300 hover:underline">
                    {bioOriginal ? tr("Xem bản dịch", "Show translation") : detectTextLang(bioRaw) === "vi" ? tr("Xem bản gốc", "Show original (Tiếng Việt)") : tr("Xem bản gốc (tiếng Anh)", "Show original")}
                  </button>
                )}
              </div>
            )}

            {/* Nút hành động trên điện thoại: rộng hết hàng, dễ bấm */}
            <div className="mt-4 flex items-center gap-2 sm:hidden">
              <div className="flex-1 [&>*]:w-full">{primaryAction}</div>
              {shareButton}
            </div>
            {isSelf && (
              <div className="mt-2.5 [&>button]:w-full sm:[&>button]:w-auto">
                <ShareCardButton
                  data={{
                    id: profile.id,
                    name: profile.name,
                    avatarUrl: profile.avatarUrl,
                    role: profile.role,
                    market: profile.market,
                    city: profile.city,
                    state: profile.state,
                    years: tech?.yearsOfExperience ?? null,
                    skills: specialties,
                    photos: portfolio,
                    openJobs: profile.jobs?.length ?? 0,
                    urgent: tech?.status === "URGENT",
                  }}
                />
              </div>
            )}
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


        {/* ===== TABS ===== */}
        <nav
          aria-label={tr("Mục hồ sơ", "Profile sections")}
          className="no-scrollbar sticky top-16 z-20 mt-0 flex gap-1 overflow-x-auto border-b border-white/10 bg-slate-950/85 px-2 backdrop-blur-md md:mt-4 md:rounded-2xl md:border md:px-1.5 md:py-1.5"
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-2 py-3 text-[13px] font-bold transition-colors md:rounded-xl md:py-2.5 ${
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
              {/* "Hồ sơ tay nghề" — điểm từ Chủ tiệm cũ + thời gian làm trung bình mỗi tiệm (tự khai báo — không có
                  bảng chấm công thật). Chỉ chủ tiệm / thợ thấy: với khách, điểm chủ tiệm chấm không có ý nghĩa. */}
              {!clientView && (
              <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/50 via-slate-900/50 to-slate-950/50 p-5">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
                <SectionTitle icon={Award} tone="text-indigo-300">{tr("Hồ sơ tay nghề", "Skill record")}</SectionTitle>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {[
                    { v: fmtScore(trustSummary?.avgOverall), l: tr("Điểm từ chủ tiệm", "Owner rating"), star: true },
                    { v: reviewCount, l: tr("Lượt đánh giá", "Reviews") },
                    { v: tech.avgTenureMonths ? `~${tech.avgTenureMonths}` : "—", l: tr("Thời gian làm mỗi tiệm (tháng)", "Avg. months per salon") },
                  ].map((x) => (
                    <div key={x.l} className="rounded-xl bg-slate-950/50 p-3 text-center ring-1 ring-white/5">
                      <p className="flex items-center justify-center gap-1 text-lg font-black text-white">
                        {x.v} {x.star && <Star className="h-3.5 w-3.5 fill-indigo-300 text-indigo-300" />}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 [overflow-wrap:anywhere]">{x.l}</p>
                    </div>
                  ))}
                </div>
              </div>
              )}

              <div className="glass-card space-y-3 rounded-2xl p-5">
                <SectionTitle icon={Sparkles}>{tr("Kỹ năng sở trường", "Top skills")}</SectionTitle>
                {specialties.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((s) => (
                      <span key={s} className="rounded-full bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-200 ring-1 ring-pink-500/25">{valueLabel(s)}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{tr("Thợ chưa cập nhật kỹ năng.", "This tech hasn't added skills yet.")}</p>
                )}
              </div>

              {portfolio.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <SectionTitle icon={Images}>{tr("Mẫu móng gần đây", "Recent work")}</SectionTitle>
                    {portfolio.length > 6 && (
                      <button onClick={() => setTab("portfolio")} className="flex items-center text-xs font-bold text-pink-300 hover:text-pink-200">
                        {tr("Xem tất cả ", "See all ")}<ChevronRight className="h-3.5 w-3.5" />
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
              : <EmptyState icon={Images} title={tr("Chưa có mẫu móng nào", "No work samples yet")} hint={tr("Thợ chưa đăng ảnh/video portfolio.", "This tech hasn't posted portfolio photos/videos.")} />
          )}

          {(isTech || isOwnerProfile) && tab === "reviews" && clientView && (
            (clientStats?.count ?? 0) > 0
              ? <ClientReviews techId={profile.id} />
              : <EmptyState icon={ShieldCheck} title={tr("Chưa có đánh giá từ khách", "No client reviews yet")} hint={tr("Đánh giá chỉ đến từ khách đã đặt lịch qua PawNail.", "Reviews only come from clients who booked through PawNail.")} />
          )}

          {isTech && tab === "reviews" && !clientView && (
            <ReviewsSection
              targetUserId={profile.id}
              targetRole="TECHNICIAN"
              viewerId={viewer?.id ?? null}
              viewerRole={viewer?.role ?? null}
              onChanged={() => setStatsVersion((v) => v + 1)}
            />
          )}

          {/* ---------- CHỦ TIỆM ---------- */}
          {isOwnerProfile && tab === "overview" && clientView && (
            <>
              <div className="glass-card space-y-3 rounded-2xl p-5">
                <SectionTitle icon={Store}>{tr("Về tiệm", "About the salon")}</SectionTitle>
                {location && <p className="flex items-center gap-2 text-sm text-slate-200"><MapPin className="h-4 w-4 text-slate-500" />{location}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {(menuCount ?? 0) > 0 && (
                    <Link href={`/menu/${profile.id}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 text-sm font-bold text-white"><CalendarCheck className="h-4 w-4" />{tr("Xem menu & đặt lịch", "Menu & booking")}</Link>
                  )}
                  <button onClick={handleContactClick} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-white/10"><MessageCircle className="h-4 w-4" />{tr("Nhắn tiệm", "Message the salon")}</button>
                </div>
              </div>
              <ClientReviews techId={profile.id} />
              <GallerySection ownerId={profile.id} />
            </>
          )}

          {isOwnerProfile && ((tab === "overview" && !clientView) || tab === "pros") && (
            <>
              {/* "Sức Khỏe Tiệm & Văn Hóa Làm Việc" — 3 tiêu chí do Thợ từng
                  làm chấm + chính sách tiệm tự khai ("Chưa cập nhật" thay vì
                  bịa mặc định). */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-slate-900/50 to-slate-950/50 p-5">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
                <SectionTitle icon={HeartHandshake} tone="text-emerald-300">{tr("Đánh giá tiệm & môi trường làm việc", "Salon ratings & work environment")}</SectionTitle>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: tr("Tổng thể", "Overall"), value: trustSummary?.avgOverall },
                    { label: tr("Sòng phẳng", "Fair pay"), value: trustSummary?.avgPunctualityOrPay },
                    { label: tr("Môi trường", "Environment"), value: trustSummary?.avgEnvironment },
                    { label: tr("Chia turn", "Turn sharing"), value: trustSummary?.avgTurnFairness },
                  ].map((item) => (
                    <div key={item.label} className="min-w-0 rounded-xl bg-slate-950/50 p-2.5 text-center ring-1 ring-white/5">
                      <p className="text-lg font-black text-emerald-300">{fmtScore(item.value)}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase leading-tight tracking-normal text-slate-500 [overflow-wrap:anywhere]">{item.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">{tr("Chấm bởi thợ từng làm tại tiệm · ", "Rated by techs who worked here · ")}{reviewCount}{tr(" lượt", reviewCount === 1 ? " rating" : " ratings")}</p>
              </div>

              <div className="glass-card divide-y divide-white/5 rounded-2xl">
                <div className="p-5 pb-3"><SectionTitle icon={Store}>{tr("Chính sách tiệm", "Salon policy")}</SectionTitle></div>
                {[
                  { icon: Users2, label: tr("Chia turn", "Turn sharing"), value: profile.turnSplitPolicy },
                  { icon: DollarSign, label: tr("Loại khách", "Clientele"), value: profile.clientTypePolicy },
                  { icon: HomeIcon, label: tr("Chỗ ở cho thợ ở xa", "Housing for out-of-town techs"), value: profile.housingSupport ? tr("Có hỗ trợ", "Provided") : tr("Không", "No") },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/5">
                      <row.icon className="h-4 w-4 text-slate-400" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                      <p className={`text-sm ${row.value ? "font-semibold text-slate-100" : "italic text-slate-500"}`}>{row.value || tr("Chưa cập nhật", "Not set")}</p>
                    </div>
                  </div>
                ))}
              </div>

              {(profile.jobs?.length ?? 0) > 0 && tab !== "pros" && (
                <button
                  onClick={() => setTab("jobs")}
                  className="glass-card flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:border-pink-500/30"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 ring-1 ring-pink-500/25">
                    <Briefcase className="h-5 w-5 text-pink-300" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-white">{profile.jobs.length}{tr(" tin đang tuyển", profile.jobs.length === 1 ? " open job" : " open jobs")}</span>
                    <span className="block text-xs text-slate-500">{tr("Xem vị trí & mức lương", "See roles & pay")}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
              )}
            </>
          )}

          {isOwnerProfile && (tab === "jobs" || tab === "pros") && (tab === "jobs" || (profile.jobs?.length ?? 0) > 0) && (
            (!profile.jobs || profile.jobs.length === 0) ? (
              <EmptyState icon={Briefcase} title={tr("Chưa có tin tuyển dụng", "No job posts yet")} hint={tr("Tiệm hiện không đăng tin tuyển nào.", "This salon has no open jobs right now.")} />
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
                      <p className="truncate text-sm font-bold text-slate-100 group-hover:text-white">{dt(job.title)}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                        <MapPin className="h-3 w-3" /> {placeLabel(job.city, job.market, job.state)}
                      </p>
                    </div>
                    {job.salaryAmount && (
                      <span className="flex-shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/20">
                        {dt(job.salaryAmount)}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-600 group-hover:text-slate-300" />
                  </Link>
                ))}
              </div>
            )
          )}

          {(isTech || isOwnerProfile) && tab === "menu" && <NailMenu userId={profile.id} />}
          {isOwnerProfile && tab === "gallery" && <GallerySection ownerId={profile.id} />}
          {isOwnerProfile && tab === "reviews" && !clientView && (
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
