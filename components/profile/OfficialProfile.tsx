"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  MessageCircle, Share2, PenSquare, Radar, ShieldCheck, Mail, Copy, FileText, Lock, HeartHandshake, BadgeCheck, Users, Newspaper,
  Briefcase, Palette, Receipt, TrendingUp, Clock, Globe2, CalendarDays, ChevronRight, Bot, Flame, MapPin, LayoutGrid,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import Flag from "@/components/ui/Flag";
import FeedPostCard, { type FeedPost } from "@/components/feed/FeedPostCard";
import { DesignsStrip } from "@/components/designs/DesignViews";
import { EmptyState, SectionTitle } from "@/components/profile/ProfileSections";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface OfficialStats { members: number; availableTechs: number; jobs30d: number; posts: number }
interface Props {
  profile: { id: string; name: string; avatarUrl: string | null; createdAt?: string; official?: OfficialStats };
  isSelf: boolean;
}
interface MiniJob { id: string; title: string; salonName: string; city: string; state: string; salaryType?: string | null; salaryAmount?: string | null; isUrgent?: boolean }

// Email hỗ trợ dùng chung toàn site (Điều khoản, Bảo mật, Quên mật khẩu) — đổi qua NEXT_PUBLIC_SUPPORT_EMAIL.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawos.com";

// Lối tắt — icon nét vẽ đồng bộ (không dùng emoji), mỗi mục 1 màu thương hiệu.
const SHORTCUTS = [
  { href: "/?tab=jobs", icon: Briefcase, vi: "Việc gấp", en: "Urgent jobs", hintVi: "Tiệm đang cần thợ ngay", hintEn: "Salons hiring now", tone: "text-orange-300 from-orange-500/25 to-rose-500/10 ring-orange-400/25" },
  { href: "/designs", icon: Palette, vi: "Mẫu nail", en: "Designs", hintVi: "Mẫu mới mỗi ngày + vật tư", hintEn: "Daily designs + materials", tone: "text-pink-300 from-pink-500/25 to-fuchsia-500/10 ring-pink-400/25" },
  { href: "/tools/income-tracker", icon: Receipt, vi: "Thuế & tip", en: "Tax & tips", hintVi: "Ghi tip, chuẩn bị mùa thuế", hintEn: "Log tips, get tax-ready", tone: "text-emerald-300 from-emerald-500/25 to-teal-500/10 ring-emerald-400/25" },
  { href: "/trends", icon: TrendingUp, vi: "Lương", en: "Pay trends", hintVi: "Lương theo tiểu bang", hintEn: "Pay by state", tone: "text-sky-300 from-sky-500/25 to-blue-500/10 ring-sky-400/25" },
  { href: "#an-toan", icon: ShieldCheck, vi: "An toàn", en: "Safety", hintVi: "Tránh lừa đảo, báo cáo", hintEn: "Avoid scams, report", tone: "text-violet-300 from-violet-500/25 to-indigo-500/10 ring-violet-400/25" },
] as const;
const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("en-US") : "—");
const card = "rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:p-5";

// Hồ sơ TÀI KHOẢN CHÍNH THỨC của PawNail (tick xanh) — trang thương hiệu kiểu
// Facebook Page / LinkedIn: bìa rộng, 2 cột trên máy tính (nội dung + cột thông
// tin dính theo khi cuộn), gọn 1 cột trên điện thoại. Số liệu là số đếm thật.
export default function OfficialProfile({ profile, isSelf }: Props) {
  useTr(); // render lại khi đổi VI/EN
  const [tab, setTab] = useState<"posts" | "about">("posts");
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [jobs, setJobs] = useState<MiniJob[] | null>(null);
  const s = profile.official;

  useEffect(() => {
    fetch(`/api/posts?authorId=${profile.id}`)
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      // Bài ghim (mở đầu bằng 📌) luôn nằm trên cùng, còn lại mới nhất trước.
      .then((d) => setPosts([...(d.posts || [])].sort((a: FeedPost, b: FeedPost) => Number(String(b.content ?? "").startsWith("📌")) - Number(String(a.content ?? "").startsWith("📌")))))
      .catch(() => setPosts([]));
    fetch("/api/jobs?limit=4")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setJobs((Array.isArray(d) ? d : d.jobs || []).slice(0, 4)))
      .catch(() => setJobs([]));
  }, [profile.id]);

  const share = async () => {
    try {
      if (navigator.share) return void (await navigator.share({ title: `${profile.name} · PawNail`, url: location.href }));
      await navigator.clipboard.writeText(location.href);
      toast.success(tr("Đã sao chép liên kết", "Link copied"));
    } catch {}
  };
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      toast.success(tr("Đã sao chép email hỗ trợ", "Support email copied"));
    } catch {}
  };
  const goSafety = (e: React.MouseEvent) => {
    e.preventDefault();
    setTab("about");
    setTimeout(() => document.getElementById("an-toan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const since = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(tr("vi-VN", "en-US"), { month: "long", year: "numeric" }) : null;

  const btn = "flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-all";
  const primary = isSelf ? (
    <Link href="/profile" className={`${btn} bg-white/[0.06] text-white ring-1 ring-white/10 hover:bg-white/10`}><PenSquare className="h-4 w-4" />{tr(" Chỉnh sửa hồ sơ", " Edit profile")}</Link>
  ) : (
    <Link href={`/messages?to=${profile.id}`} className={`${btn} bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-600/30 hover:brightness-110`}><MessageCircle className="h-4 w-4" />{tr(" Nhắn tin hỗ trợ", " Message support")}</Link>
  );

  const stats = [
    { v: fmt(s?.members), l: tr("Thành viên", "Members") },
    { v: fmt(s?.availableTechs), l: tr("Thợ đang rảnh", "Techs available") },
    { v: fmt(s?.jobs30d), l: tr("Tin 30 ngày", "Jobs · 30d") },
    { v: fmt(s?.posts), l: tr("Bài cộng đồng", "Community posts") },
  ];

  const infoRows = (
    <ul className="space-y-2.5 text-sm text-slate-300">
      <li className="flex items-center gap-3"><Globe2 className="h-4 w-4 flex-shrink-0 text-slate-500" /><span className="flex items-center gap-1.5"><Flag code="US" /><Flag code="AU" />{tr(" Phục vụ thợ & tiệm tại Mỹ và Úc", " Serving techs & salons in the US and Australia")}</span></li>
      <li className="flex items-center gap-3"><Clock className="h-4 w-4 flex-shrink-0 text-slate-500" />{tr("Thường trả lời trong 24 giờ", "Usually replies within 24 hours")}</li>
      <li className="flex items-center gap-3"><Mail className="h-4 w-4 flex-shrink-0 text-slate-500" /><span className="truncate">{SUPPORT_EMAIL}</span></li>
      <li className="flex items-center gap-3"><Globe2 className="h-4 w-4 flex-shrink-0 text-slate-500" />bitpawos.com</li>
      {since && <li className="flex items-center gap-3"><CalendarDays className="h-4 w-4 flex-shrink-0 text-slate-500" />{tr(`Hoạt động từ ${since}`, `Active since ${since}`)}</li>}
    </ul>
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 pb-28 md:px-6 md:pb-12 md:pt-6">
      {/* ===== Phần đầu: bìa + danh tính ===== */}
      <section className="relative overflow-hidden border-b border-white/10 bg-slate-950/60 md:rounded-3xl md:border md:shadow-2xl md:shadow-black/40">
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-pink-600 via-fuchsia-600 to-indigo-700 sm:h-48 lg:h-56">
          <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cho1.jpg" alt="" aria-hidden className="absolute -right-6 -top-6 h-48 w-48 rotate-12 rounded-[2.5rem] object-cover opacity-25 sm:h-64 sm:w-64 lg:right-10 lg:h-72 lg:w-72" />
          <div className="absolute bottom-3 right-4 rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/90 backdrop-blur sm:right-6 sm:text-[11px]">PawNail Jobs · Official</div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80" />
        </div>

        <div className="relative px-4 pb-4 sm:px-6 lg:px-8">
          <div className="-mt-11 flex items-end justify-between gap-3 sm:-mt-14">
            <span className="relative">
              <Avatar src={profile.avatarUrl || "/cho1.jpg"} name={profile.name} seed={profile.id} loading="eager" className="h-[88px] w-[88px] shadow-xl shadow-black/50 ring-4 ring-slate-950 sm:h-28 sm:w-28 lg:h-32 lg:w-32" />
              <span className="absolute bottom-1 right-1 rounded-full bg-slate-950 p-0.5"><VerifiedBadge className="h-7 w-7" /></span>
            </span>
            <div className="hidden items-center gap-2 pb-1 sm:flex">
              <button onClick={share} aria-label={tr("Chia sẻ hồ sơ", "Share profile")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Share2 className="h-4 w-4" /></button>
              {primary}
            </div>
          </div>

          <div className="mt-3 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[26px] font-black tracking-tight text-white sm:text-[30px]">
                {profile.name} <VerifiedBadge className="h-6 w-6" />
              </h1>
              <p className="mt-0.5 text-sm font-semibold text-sky-300">{tr("Tài khoản chính thức của PawNail Jobs", "Official PawNail Jobs account")}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200 ring-1 ring-sky-500/30"><BadgeCheck className="h-3.5 w-3.5" />{tr(" Đã xác minh", " Verified")}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-1 text-[11px] font-bold text-pink-200 ring-1 ring-pink-500/25"><ShieldCheck className="h-3.5 w-3.5" />{tr(" Kênh hỗ trợ & an toàn", " Support & safety")}</span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                {tr("Nền tảng kết nối thợ nail và chủ tiệm người Việt tại Mỹ & Úc — miễn phí, không qua môi giới. Nhắn tin cho chúng tôi khi cần hỗ trợ tài khoản, báo lừa đảo hay góp ý tính năng.", "Connecting Vietnamese nail techs and salon owners across the US & Australia — free, no middlemen. Message us for account help, to report scams, or to suggest features.")}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 lg:hidden">
                <span className="flex items-center gap-1"><Flag code="US" /><Flag code="AU" /> {tr("Mỹ & Úc", "US & AU")}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{tr("Trả lời trong 24 giờ", "Replies within 24h")}</span>
              </p>
            </div>
          </div>

          {/* Lối tắt — điện thoại: lưới 5 ô đều nhau; máy tính: nằm ở cột phải */}
          <nav aria-label={tr("Lối tắt", "Shortcuts")} className="mt-4 grid grid-cols-5 gap-1 lg:hidden">
            {SHORTCUTS.map((h) => (
              <Link key={h.href} href={h.href} onClick={h.href === "#an-toan" ? goSafety : undefined} className="flex flex-col items-center gap-1.5 rounded-xl py-1 text-center active:bg-white/[0.04]">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${h.tone}`}><h.icon className="h-5 w-5" strokeWidth={2.2} /></span>
                <span className="text-[11px] font-semibold leading-tight text-slate-300">{tr(h.vi, h.en)}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-4 flex items-center gap-2 sm:hidden">
            <div className="flex-1 [&>*]:w-full">{primary}</div>
            <button onClick={share} aria-label={tr("Chia sẻ hồ sơ", "Share profile")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-white/10"><Share2 className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Số liệu cộng đồng — đếm thật */}
        <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5 bg-white/[0.015]">
          {stats.map((x) => (
            <div key={x.l} className="px-1 py-3 text-center sm:py-4">
              <p className="text-lg font-black tabular-nums text-white sm:text-xl">{x.v}</p>
              <p className="mt-0.5 text-[10.5px] font-semibold leading-tight text-slate-500 sm:text-xs">{x.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Thân: nội dung + cột thông tin (máy tính) ===== */}
      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="min-w-0">
          <nav aria-label={tr("Mục hồ sơ", "Profile sections")} className="sticky top-16 z-20 flex gap-1 border-b border-white/10 bg-slate-950/85 px-2 backdrop-blur-md md:mt-4 md:rounded-2xl md:border md:px-1.5 md:py-1.5 lg:mt-0">
            {([["posts", tr("Bài đăng", "Posts"), Newspaper], ["about", tr("Giới thiệu", "About"), HeartHandshake]] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined} className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-[13px] font-bold md:rounded-xl md:py-2.5 ${tab === k ? "text-white md:bg-white/[0.07]" : "text-slate-500 hover:text-slate-200"}`}>
                <Icon className="h-4 w-4" /> {label}
                {tab === k && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 md:hidden" />}
              </button>
            ))}
          </nav>

          <div className="space-y-4 px-4 pt-5 md:px-0">
            {/* Bộ sưu tập mẫu nail mới (đã duyệt) — tài khoản chính thức là nơi khoe mẫu mỗi ngày. */}
            {tab === "posts" && <DesignsStrip />}
            {tab === "posts" &&
              (posts === null ? (
                <div className="skeleton h-40 rounded-2xl" />
              ) : posts.length === 0 ? (
                isSelf ? (
                  <div className={`${card} flex flex-col items-center gap-3 py-8 text-center`}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30"><Bot className="h-6 w-6" /></span>
                    <p className="text-sm font-bold text-white">{tr("Chưa có bài đăng nào", "No posts yet")}</p>
                    <p className="max-w-sm text-xs leading-relaxed text-slate-400">{tr("Bot nội dung đã soạn sẵn 2 bài ghim (Chào mừng + An toàn) và các bài thuế, tip, an toàn theo đúng thời điểm — đọc, sửa nếu cần rồi bấm đăng.", "The content bot has drafted 2 pinned posts (Welcome + Safety) and timely tax, tips and safety posts — review, edit and publish.")}</p>
                    <Link href="/admin/studio#bot-noi-dung" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-500"><Bot className="h-4 w-4" />{tr(" Mở Bot nội dung", " Open content bot")}</Link>
                  </div>
                ) : (
                  <EmptyState icon={Newspaper} title={tr("Chưa có bài đăng", "No posts yet")} hint={tr("Thông báo chính thức từ PawNail sẽ hiện ở đây.", "Official PawNail announcements will appear here.")} />
                )
              ) : (
                posts.map((p) => <FeedPostCard key={p.id} post={p} onDeleted={(id) => setPosts((prev) => (prev || []).filter((x) => x.id !== id))} />)
              ))}

            {tab === "about" && (
              <>
                <div className={`${card} space-y-3 lg:hidden`}>
                  <SectionTitle icon={Globe2}>{tr("Thông tin", "Info")}</SectionTitle>
                  {infoRows}
                </div>
                <div id="an-toan" className={`${card} scroll-mt-28 space-y-3`}>
                  <SectionTitle icon={HeartHandshake}>{tr("Cam kết của PawNail", "Our commitments")}</SectionTitle>
                  <ul className="space-y-2.5 text-sm text-slate-300">
                    <li className="flex gap-2.5"><BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />{tr(" Miễn phí kết nối — thợ và chủ tiệm nói chuyện trực tiếp, không qua môi giới.", " Free to connect — techs and owners talk directly, no middlemen.")}</li>
                    <li className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />{tr(" Đánh giá 2 chiều từ người làm việc thật; báo cáo vi phạm được xem xét trong 24 giờ.", " Two-way reviews from real coworkers; reports reviewed within 24 hours.")}</li>
                    <li className="flex gap-2.5"><Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />{tr(" Không bao giờ yêu cầu chuyển tiền đặt cọc để \"giữ chỗ làm\" — gặp trường hợp này hãy báo ngay.", " We never ask for a deposit to \"hold a job\" — if anyone does, report it right away.")}</li>
                  </ul>
                </div>
                <div className={`${card} space-y-3`}>
                  <SectionTitle icon={Mail}>{tr("Liên hệ", "Contact")}</SectionTitle>
                  <div className="flex items-center gap-2 rounded-xl bg-slate-900/70 px-3.5 py-2.5 ring-1 ring-white/10">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 select-all text-sm font-semibold text-slate-100">{SUPPORT_EMAIL}</span>
                    <button onClick={copyEmail} aria-label={tr("Sao chép email", "Copy email")} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><Copy className="h-4 w-4" /></button>
                  </div>
                  <p className="text-sm text-slate-300">{tr("Cách nhanh nhất: nhắn tin trực tiếp trong app — thường trả lời trong 24 giờ. Báo lừa đảo: bấm ⋮ → Báo cáo trên tin nhắn, bài đăng hoặc hồ sơ.", "Fastest: message us in the app — we usually reply within 24 hours. To report a scam, tap ⋮ → Report on the message, post or profile.")}</p>
                  {!isSelf && <Link href={`/messages?to=${profile.id}`} className="flex items-center gap-2 text-sm font-bold text-sky-300 hover:text-sky-200"><MessageCircle className="h-4 w-4" />{tr(" Nhắn tin cho PawNail Jobs", " Message PawNail Jobs")}</Link>}
                </div>
                <div className={`${card} space-y-1`}>
                  <SectionTitle icon={FileText}>{tr("Chính sách", "Policies")}</SectionTitle>
                  <Link href="/terms" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-slate-300 hover:text-white"><FileText className="h-4 w-4 text-slate-500" />{tr(" Điều khoản dịch vụ", " Terms of service")}</Link>
                  <Link href="/privacy" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-slate-300 hover:text-white"><Lock className="h-4 w-4 text-slate-500" />{tr(" Chính sách bảo mật", " Privacy policy")}</Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cột phải (máy tính) — lấp khoảng trống bằng thông tin CÓ ÍCH, dính theo khi cuộn */}
        <aside aria-label={tr("Thông tin PawNail", "About PawNail")} className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
          <div className={`${card} space-y-3`}>
            <SectionTitle icon={Globe2}>{tr("Thông tin", "Info")}</SectionTitle>
            {infoRows}
          </div>

          <div className={card}>
            <SectionTitle icon={LayoutGrid}>{tr("Lối tắt", "Shortcuts")}</SectionTitle>
            <ul className="mt-2 divide-y divide-white/5">
              {SHORTCUTS.map((h) => (
                <li key={h.href}>
                  <Link href={h.href} onClick={h.href === "#an-toan" ? goSafety : undefined} className="group flex items-center gap-3 py-2.5">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${h.tone}`}><h.icon className="h-4 w-4" strokeWidth={2.2} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-100">{tr(h.vi, h.en)}</span>
                      <span className="block truncate text-xs text-slate-500">{tr(h.hintVi, h.hintEn)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={card}>
            <div className="flex items-center justify-between">
              <SectionTitle icon={Flame}>{tr("Việc gấp mới nhất", "Latest urgent jobs")}</SectionTitle>
              <Link href="/?tab=jobs" className="text-xs font-bold text-sky-300 hover:text-sky-200">{tr("Xem tất cả", "See all")}</Link>
            </div>
            {jobs === null ? (
              <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : jobs.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">{tr("Chưa có tin tuyển mới.", "No new jobs yet.")}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="block rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5 hover:bg-white/[0.06]">
                      <p className="truncate text-sm font-bold text-slate-100">{j.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3 w-3 flex-shrink-0" />{j.salonName} · {j.city}, {j.state}</p>
                      {j.salaryAmount && <p className="mt-0.5 text-xs font-bold text-emerald-300">{j.salaryAmount}{j.salaryType ? ` · ${valueLabel(j.salaryType)}` : ""}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isSelf && (
            <div className={card}>
              <SectionTitle icon={ShieldCheck}>{tr("Công cụ quản trị", "Admin tools")}</SectionTitle>
              <div className="mt-2 grid gap-2">
                <Link href="/admin/studio" className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Radar className="h-4 w-4 text-pink-300" />{tr(" Phòng nội dung", " Content studio")}</Link>
                <Link href="/admin/studio#bot-noi-dung" className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Bot className="h-4 w-4 text-sky-300" />{tr(" Bot nội dung", " Content bot")}</Link>
                <Link href="/admin/leads" className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Users className="h-4 w-4 text-violet-300" /> Lead Radar</Link>
                <Link href="/admin/reports" className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><ShieldCheck className="h-4 w-4 text-amber-300" />{tr(" Báo cáo vi phạm", " Reports")}</Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
