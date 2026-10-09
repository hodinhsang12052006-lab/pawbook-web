"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Radar, Wallet, ShoppingBag, PlusCircle, ShieldAlert, ChevronRight, TrendingUp, Sparkles } from "lucide-react";
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
    { href: "/designs", label: tr("Mẫu nail mới", "New nail designs"), stat: tr("Ý tưởng mỗi ngày + vật tư cần chuẩn bị", "Daily ideas + materials to prep"), icon: Sparkles, tone: "bg-pink-500/15 text-pink-300" },
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
    return (
      <nav aria-label={tr("Công cụ", "Tools")} className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
        {tools.map(({ href, label, stat, icon: Icon, tone, badge }) => (
          <Link key={href} href={href} className="glass-card relative flex w-40 flex-shrink-0 flex-col gap-2 rounded-2xl p-3 active:scale-95 transition-transform">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[13px] font-bold text-white">{label}</span>
            <span className="line-clamp-2 text-[11px] leading-snug text-slate-400">{stat}</span>
            {!!badge && badge > 0 && (
              <span className="absolute right-2.5 top-2.5 rounded-full bg-pink-600 px-1.5 text-[10px] font-bold text-white">{badge > 9 ? "9+" : badge}</span>
            )}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label={tr("Công cụ", "Tools")} className="space-y-1">
      {tools.map(({ href, label, stat, icon: Icon, tone, badge }) => (
        <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 transition-colors">
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${tone}`}>
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
