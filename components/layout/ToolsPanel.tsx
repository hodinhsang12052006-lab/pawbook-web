"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Radar, Wallet, ShoppingBag, PlusCircle, ShieldAlert, ChevronRight, TrendingUp, Sparkles, ScanLine, CalendarCheck, Palette, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { useUnreadMessages } from "@/lib/UnreadMessagesContext";
import { getRadarEstimate } from "@/lib/nailRadarData";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface Tool {
  href: string;
  label: string;
  stat: string;
  icon: LucideIcon;
  tone: string; // màu nền icon
  badge?: number;
}

// Thu nhập tuần này — đọc cùng localStorage mà /tools/income-tracker ghi
// (tuần tính từ Thứ 2, tip về 100% cho thợ, tiền dịch vụ chia theo %).
function weeklyIncome(userId: string): number | null {
  try {
    const raw = localStorage.getItem(`bitpaw_income_${userId}`);
    if (!raw) return null;
    const entries: { date: string; serviceAmount: number; tipCash: number; tipCredit: number }[] = JSON.parse(raw);
    const split = Number(localStorage.getItem(`bitpaw_income_split_${userId}`) || 60);
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() + ((monday.getDay() === 0 ? -6 : 1) - monday.getDay()));
    const total = entries
      .filter((e) => new Date(e.date + "T00:00:00") >= monday)
      .reduce((s, e) => s + e.serviceAmount * (split / 100) + e.tipCash + e.tipCredit, 0);
    return Math.round(total);
  } catch {
    return null;
  }
}

function useTools(): Tool[] {
  const { user } = useSessionUser();
  const { unreadCount } = useUnreadMessages();
  const [income, setIncome] = useState<number | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [newBookings, setNewBookings] = useState(0);

  useEffect(() => {
    if (user?.role !== "TECHNICIAN" && user?.role !== "OWNER") return;
    fetch("/api/bookings?count=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNewBookings(d?.counts?.new ?? 0))
      .catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (user?.id && user.role === "TECHNICIAN") setIncome(weeklyIncome(user.id));
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    fetch("/api/admin/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setReportCount(Array.isArray(rows) ? rows.length : 0))
      .catch(() => {});
  }, [user?.role]);

  const market = user?.market === "AU" ? "AU" : "US";
  const radar = user?.state ? getRadarEstimate(market, user.state, "BOT") : null;
  const radarStat = radar
    ? tr(`${user.state} · $${radar.rateMin.toLocaleString("en-US")}–${radar.rateMax.toLocaleString("en-US")}/tuần`, `${user.state} · $${radar.rateMin.toLocaleString("en-US")}–${radar.rateMax.toLocaleString("en-US")}/week`)
    : tr("Mức bao lương & chia turn theo bang", "Pay & commission rates by state");

  const roleTool: Tool =
    user?.role === "ADMIN"
      ? { href: "/admin/reports", label: tr("Báo cáo vi phạm", "Reports"), stat: reportCount === null ? tr("Kiểm duyệt nội dung", "Content moderation") : tr(`${reportCount} báo cáo cần xem`, `${reportCount} reports to review`), icon: ShieldAlert, tone: "bg-amber-500/15 text-amber-300" }
      : user?.role === "OWNER"
      ? { href: "/jobs/create", label: tr("Đăng tin tuyển thợ", "Post a job"), stat: tr(`${user?.jobs?.length ?? 0} tin đang mở`, `${user?.jobs?.length ?? 0} open jobs`), icon: PlusCircle, tone: "bg-pink-500/15 text-pink-300" }
      : { href: "/tools/income-tracker", label: tr("Thu nhập & tip", "Income & tips"), stat: income === null ? tr("Ghi turn + tip mỗi tối", "Log turns + tips nightly") : tr(`Tuần này: $${income.toLocaleString("en-US")}`, `This week: $${income.toLocaleString("en-US")}`), icon: Wallet, tone: "bg-violet-500/15 text-violet-300" };

  return [
    { href: "/messages", label: tr("Tin nhắn", "Messages"), stat: unreadCount > 0 ? tr(`${unreadCount} tin chưa đọc`, `${unreadCount} unread`) : tr("Chat với tiệm & thợ", "Chat with salons & techs"), icon: MessageCircle, tone: "bg-sky-500/15 text-sky-300", badge: unreadCount },
    roleTool,
    ...(user?.role === "TECHNICIAN" || user?.role === "OWNER"
      ? [{ href: "/bookings", label: tr("Lịch hẹn", "Bookings"), stat: newBookings > 0 ? tr(`${newBookings} khách mới đặt lịch`, `${newBookings} new requests`) : tr("Khách đặt từ menu / mã QR", "Requests from your menu / QR"), icon: CalendarCheck, tone: "bg-pink-500/15 text-pink-300", badge: newBookings } as Tool,
        { href: "/tryon", label: tr("Thử mẫu trên tay", "Try-on looks"), stat: tr("Vẽ 10 mẫu trend lên tay khách + giá", "Paint 10 trending looks on a client's hand"), icon: Sparkles, tone: "bg-fuchsia-500/15 text-fuchsia-300" } as Tool,
        { href: "/consult", label: tr("Soi tay tư vấn", "Hand consult"), stat: tr("Chụp tay khách → tình trạng + mẫu hợp", "Snap a client's hand → condition + matching designs"), icon: ScanLine, tone: "bg-rose-500/15 text-rose-300" } as Tool]
      : []),
    { href: "/designs", label: tr("Mẫu nail mới", "New nail designs"), stat: tr("Ý tưởng mỗi ngày + vật tư cần chuẩn bị", "Daily ideas + materials to prep"), icon: Palette, tone: "bg-pink-500/15 text-pink-300" },
    { href: "/trends", label: tr("Xu hướng tuần", "Weekly trends"), stat: tr("Mẫu hot · thợ nổi bật · lương", "Hot designs · top techs · pay"), icon: TrendingUp, tone: "bg-fuchsia-500/15 text-fuchsia-300" },
    { href: "/tools/radar", label: "Nail Radar", stat: radarStat, icon: Radar, tone: "bg-amber-500/15 text-amber-300" },
    { href: "/supply", label: tr("Kho hàng vật tư", "Supply store"), stat: tr("Vật tư giá sỉ từ các tiệm", "Wholesale supplies from salons"), icon: ShoppingBag, tone: "bg-emerald-500/15 text-emerald-300" },
  ];
}

// variant "list": khối dọc trong Sidebar desktop · "row": hàng thẻ vuốt
// ngang trên trang chủ mobile (trước đây mobile không có lối tắt công cụ).
export default function ToolsPanel({ variant }: { variant: "list" | "row" }) {
  useTr(); // render lại khi đổi VI/EN
  const tools = useTools();

  if (variant === "row") {
    // Hàng lối tắt kiểu app: đúng 5 ô, vừa 1 hàng từ 360px (dưới 360px thì vuốt ngang). "Tin nhắn" đã có ở
    // thanh dưới nên không lặp lại; ô thứ nhất = việc chính theo vai trò (đăng tin / thu nhập).
    const all = tools.map((t, i) => ({ ...t, primary: i === 1 })).filter((t) => t.href !== "/messages");
    // > 5 công cụ: 4 ô + ô "Tất cả" mở trang /tools (trước đây cắt cụt còn 5 → mất Xu hướng, Nail Radar, Kho vật tư)
    const row: (typeof all[number])[] = all.length > 5
      ? [...all.slice(0, 4), { href: "/tools", label: tr("Tất cả công cụ", "All tools"), stat: tr("Xem mọi công cụ", "See every tool"), icon: LayoutGrid, tone: "", primary: false }]
      : all;
    return (
      <nav aria-label={tr("Công cụ", "Tools")} className="-mx-4 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
        {row.map(({ href, label, stat, icon: Icon, badge, primary }) => (
          <Link key={href} href={href} title={stat} className="pn-qa relative flex w-[72px] flex-shrink-0 flex-col items-center gap-1.5 rounded-2xl px-0.5 py-1 text-center transition-transform duration-[120ms] active:scale-[.97] min-[360px]:w-auto">
            <span className={`pn-qa-tile relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl ${primary ? "pn-qa-primary" : ""}`}>
              <Icon className="h-[22px] w-[22px]" />
              {!!badge && badge > 0 && (
                <span className="pn-micro absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full bg-pn-brand px-1 leading-[20px] text-white ring-2 ring-pn-canvas tabular-nums">{badge > 9 ? "9+" : badge}</span>
              )}
            </span>
            <span className="line-clamp-2 text-[13px] font-normal leading-4 text-pn-text-2">{label}</span>
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label={tr("Công cụ", "Tools")} className="space-y-1">
      {tools.map(({ href, label, stat, icon: Icon, badge }) => (
        <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 transition-colors">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-slate-100">{label}</span>
            <span className="block truncate text-[11px] text-slate-500 group-hover:text-slate-400">{stat}</span>
          </span>
          {!!badge && badge > 0 ? (
            <span className="rounded-full bg-pink-600 px-1.5 text-[10px] font-bold text-white">{badge > 9 ? "9+" : badge}</span>
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-600 group-hover:text-slate-400" />
          )}
        </Link>
      ))}
    </nav>
  );
}
