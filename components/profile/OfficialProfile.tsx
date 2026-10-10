"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { MessageCircle, Share2, PenSquare, Radar, ShieldCheck, Mail, Copy, FileText, Lock, HeartHandshake, BadgeCheck, Users, Briefcase, Sparkles, Newspaper } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import Flag from "@/components/ui/Flag";
import FeedPostCard, { type FeedPost } from "@/components/feed/FeedPostCard";
import { DesignsStrip } from "@/components/designs/DesignViews";
import { EmptyState, SectionTitle } from "@/components/profile/ProfileSections";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface OfficialStats { members: number; availableTechs: number; jobs30d: number; posts: number }
interface Props {
  profile: { id: string; name: string; avatarUrl: string | null; createdAt?: string; official?: OfficialStats };
  isSelf: boolean;
}

// Email hỗ trợ dùng chung toàn site (Điều khoản, Bảo mật, Quên mật khẩu) — đổi qua NEXT_PUBLIC_SUPPORT_EMAIL.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawos.com";

// Lối tắt "Nổi bật" — dẫn tới các mục người dùng cần nhất.
const HIGHLIGHTS: { href: string; emoji: string; vi: string; en: string }[] = [
  { href: "/?tab=jobs", emoji: "💼", vi: "Việc gấp", en: "Urgent jobs" },
  { href: "/designs", emoji: "💅", vi: "Mẫu nail", en: "Designs" },
  { href: "/tools/income-tracker", emoji: "💵", vi: "Thuế & tip", en: "Tax & tips" },
  { href: "/trends", emoji: "📈", vi: "Lương", en: "Pay trends" },
  { href: "#an-toan", emoji: "🛡️", vi: "An toàn", en: "Safety" },
];
const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("en-US") : "—");

// Hồ sơ TÀI KHOẢN CHÍNH THỨC của PawNail (tick xanh) — kênh hỗ trợ & thông
// báo của nền tảng. Số liệu cộng đồng ở đây là số đếm thật từ hệ thống.
export default function OfficialProfile({ profile, isSelf }: Props) {
  useTr(); // render lại khi đổi VI/EN
  const [tab, setTab] = useState<"posts" | "about">("posts");
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const s = profile.official;

  useEffect(() => {
    fetch(`/api/posts?authorId=${profile.id}`)
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      // Bài ghim (mở đầu bằng 📌) luôn nằm trên cùng, còn lại mới nhất trước.
      .then((d) => setPosts([...(d.posts || [])].sort((a: FeedPost, b: FeedPost) => Number(String(b.content ?? "").startsWith("📌")) - Number(String(a.content ?? "").startsWith("📌")))))
      .catch(() => setPosts([]));
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

  const btn = "flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-all";
  const primary = isSelf ? (
    <Link href="/profile" className={`${btn} bg-white/[0.06] text-white ring-1 ring-white/10 hover:bg-white/10`}><PenSquare className="h-4 w-4" />{tr(" Chỉnh sửa hồ sơ", " Edit profile")}</Link>
  ) : (
    <Link href={`/messages?to=${profile.id}`} className={`${btn} bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-600/30 hover:brightness-110`}><MessageCircle className="h-4 w-4" />{tr(" Nhắn tin hỗ trợ", " Message support")}</Link>
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 pb-28 md:px-6 md:pb-12 md:pt-6">
      <section className="relative overflow-hidden border-b border-white/10 bg-slate-950/60 md:rounded-3xl md:border md:shadow-2xl md:shadow-black/40">
        {/* Bìa thương hiệu */}
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-pink-600 via-fuchsia-600 to-indigo-700 sm:h-48">
          <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:18px_18px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cho1.jpg" alt="" aria-hidden className="absolute -right-6 -top-6 h-48 w-48 rotate-12 rounded-[2.5rem] object-cover opacity-25 sm:h-64 sm:w-64" />
          <div className="absolute bottom-3 right-4 rounded-full bg-black/30 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white/90 backdrop-blur sm:right-6">PawNail Jobs · Official</div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80" />
        </div>

        <div className="relative px-4 pb-5 sm:px-6">
          <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
            <span className="relative">
              <Avatar src={profile.avatarUrl || "/cho1.jpg"} name={profile.name} seed={profile.id} loading="eager" className="h-24 w-24 shadow-xl shadow-black/50 ring-4 ring-slate-950 sm:h-28 sm:w-28" />
              <span className="absolute bottom-1 right-1 rounded-full bg-slate-950 p-0.5"><VerifiedBadge className="h-7 w-7" /></span>
            </span>
            <div className="hidden items-center gap-2 pb-1 sm:flex">
              <button onClick={share} aria-label={tr("Chia sẻ hồ sơ", "Share profile")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Share2 className="h-4 w-4" /></button>
              {primary}
            </div>
          </div>

          <h1 className="mt-3 flex items-center gap-2 text-2xl font-black tracking-tight text-white sm:text-[28px]">
            {profile.name} <VerifiedBadge className="h-6 w-6" />
          </h1>
          <p className="mt-0.5 text-sm font-semibold text-sky-300">{tr("Tài khoản chính thức của PawNail Jobs", "Official PawNail Jobs account")}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200 ring-1 ring-sky-500/30"><BadgeCheck className="h-3.5 w-3.5" />{tr(" Đã xác minh", " Verified")}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-1 text-[11px] font-bold text-pink-200 ring-1 ring-pink-500/25"><ShieldCheck className="h-3.5 w-3.5" />{tr(" Kênh hỗ trợ & an toàn", " Support & safety")}</span>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
            {tr("Nền tảng kết nối thợ nail và chủ tiệm người Việt tại Mỹ & Úc — miễn phí, không qua môi giới. Nhắn tin cho chúng tôi khi cần hỗ trợ tài khoản, báo lừa đảo hay góp ý tính năng.", "Connecting Vietnamese nail techs and salon owners across the US & Australia — free, no middlemen. Message us for account help, to report scams, or to suggest features.")}
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400" aria-label={tr("Thông tin", "Info")}>
            <li className="flex items-center gap-1.5"><Flag code="US" /><Flag code="AU" /> {tr("Mỹ & Úc", "US & Australia")}</li>
            <li>⏱ {tr("Thường trả lời trong 24 giờ", "Usually replies within 24 hours")}</li>
            <li>🌐 bitpawos.com</li>
          </ul>
          <nav aria-label={tr("Nổi bật", "Highlights")} className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
            {HIGHLIGHTS.map((h) => (
              <Link key={h.href} href={h.href} onClick={h.href === "#an-toan" ? (e) => { e.preventDefault(); setTab("about"); setTimeout(() => document.getElementById("an-toan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } : undefined} className="flex w-[68px] flex-shrink-0 flex-col items-center gap-1.5 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/25 to-fuchsia-500/25 text-2xl ring-2 ring-sky-400/40">{h.emoji}</span>
                <span className="text-[11px] font-semibold leading-tight text-slate-300">{tr(h.vi, h.en)}</span>
              </Link>
            ))}
          </nav>

          {isSelf && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/admin/studio" className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Radar className="h-3.5 w-3.5 text-pink-300" />{tr(" Phòng nội dung", " Content studio")}</Link>
              <Link href="/admin/leads" className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Users className="h-3.5 w-3.5 text-sky-300" /> Lead Radar</Link>
              <Link href="/admin/reports" className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><ShieldCheck className="h-3.5 w-3.5 text-amber-300" />{tr(" Báo cáo vi phạm", " Reports")}</Link>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 sm:hidden">
            <div className="flex-1 [&>*]:w-full">{primary}</div>
            <button onClick={share} aria-label={tr("Chia sẻ hồ sơ", "Share profile")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-white/10"><Share2 className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Số liệu cộng đồng — đếm thật */}
        <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5 bg-white/[0.015]">
          {[
            { v: fmt(s?.members), l: tr("Thành viên", "Members"), icon: Users },
            { v: fmt(s?.availableTechs), l: tr("Thợ sẵn sàng", "Techs available"), icon: Sparkles },
            { v: fmt(s?.jobs30d), l: tr("Tin tuyển 30 ngày", "Jobs (30 days)"), icon: Briefcase },
            { v: fmt(s?.posts), l: tr("Bài cộng đồng", "Community posts"), icon: Newspaper },
          ].map((x) => (
            <div key={x.l} className="px-1 py-3.5 text-center">
              <p className="text-lg font-black tabular-nums text-white">{x.v}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{x.l}</p>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label={tr("Mục hồ sơ", "Profile sections")} className="sticky top-16 z-20 flex gap-1 border-b border-white/10 bg-slate-950/85 px-2 backdrop-blur-md md:mt-4 md:rounded-2xl md:border md:px-1.5 md:py-1.5">
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
            <EmptyState icon={Newspaper} title={tr("Chưa có bài đăng", "No posts yet")} hint={isSelf ? tr("Đăng thông báo, mẹo nghề hay tin ngành từ bảng tin hoặc Phòng nội dung.", "Post announcements, tips or industry news from the feed or Content studio.") : tr("Thông báo chính thức từ PawNail sẽ hiện ở đây.", "Official PawNail announcements will appear here.")} />
          ) : (
            posts.map((p) => <FeedPostCard key={p.id} post={p} onDeleted={(id) => setPosts((prev) => (prev || []).filter((x) => x.id !== id))} />)
          ))}

        {tab === "about" && (
          <>
            <div id="an-toan" className="glass-card scroll-mt-28 space-y-3 rounded-2xl p-5">
              <SectionTitle icon={HeartHandshake}>{tr("Cam kết của PawNail", "Our commitments")}</SectionTitle>
              <ul className="space-y-2.5 text-sm text-slate-300">
                <li className="flex gap-2.5"><BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />{tr(" Miễn phí kết nối — thợ và chủ tiệm nói chuyện trực tiếp, không qua môi giới.", " Free to connect — techs and owners talk directly, no middlemen.")}</li>
                <li className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />{tr(" Đánh giá 2 chiều từ người làm việc thật; báo cáo vi phạm được xem xét trong 24 giờ.", " Two-way reviews from real coworkers; reports reviewed within 24 hours.")}</li>
                <li className="flex gap-2.5"><Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />{tr(" Không bao giờ yêu cầu chuyển tiền đặt cọc để \"giữ chỗ làm\" — gặp trường hợp này hãy báo ngay.", " We never ask for a deposit to \"hold a job\" — if anyone does, report it right away.")}</li>
              </ul>
            </div>
            <div className="glass-card space-y-3 rounded-2xl p-5">
              <SectionTitle icon={Mail}>{tr("Liên hệ", "Contact")}</SectionTitle>
              {SUPPORT_EMAIL && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-950/60 px-3.5 py-2.5 ring-1 ring-white/10">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="flex-1 select-all text-sm font-semibold text-slate-100">{SUPPORT_EMAIL}</span>
                  <button onClick={copyEmail} aria-label={tr("Sao chép email", "Copy email")} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><Copy className="h-4 w-4" /></button>
                </div>
              )}
              <p className="text-sm text-slate-300">{tr("Cách nhanh nhất: nhắn tin trực tiếp trong app — thường trả lời trong 24 giờ. Báo lừa đảo: bấm ⋮ → Báo cáo trên tin nhắn, bài đăng hoặc hồ sơ.", "Fastest: message us in the app — we usually reply within 24 hours. To report a scam, tap ⋮ → Report on the message, post or profile.")}</p>
              {!isSelf && <Link href={`/messages?to=${profile.id}`} className="flex items-center gap-2 text-sm font-bold text-sky-300 hover:text-sky-200"><MessageCircle className="h-4 w-4" />{tr(" Nhắn tin cho PawNail Jobs", " Message PawNail Jobs")}</Link>}
            </div>
            <div className="glass-card space-y-2 rounded-2xl p-5">
              <SectionTitle icon={FileText}>{tr("Chính sách", "Policies")}</SectionTitle>
              <Link href="/terms" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-slate-300 hover:text-white"><FileText className="h-4 w-4 text-slate-500" />{tr(" Điều khoản dịch vụ", " Terms of service")}</Link>
              <Link href="/privacy" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-slate-300 hover:text-white"><Lock className="h-4 w-4 text-slate-500" />{tr(" Chính sách bảo mật", " Privacy policy")}</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
