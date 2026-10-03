"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Radar, Wallet, ShoppingBag, PlusCircle, ShieldAlert, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { useUnreadMessages } from "@/lib/UnreadMessagesContext";
import { getRadarEstimate } from "@/lib/nailRadarData";

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
    ? `${user.state} · $${radar.rateMin.toLocaleString("en-US")}–${radar.rateMax.toLocaleString("en-US")}/tuần`
    : "Mức bao lương & chia turn theo bang";

  const roleTool: Tool =
    user?.role === "ADMIN"
      ? { href: "/admin/reports", label: "Báo cáo vi phạm", stat: reportCount === null ? "Kiểm duyệt nội dung" : `${reportCount} báo cáo cần xem`, icon: ShieldAlert, tone: "bg-amber-500/15 text-amber-300" }
      : user?.role === "OWNER"
      ? { href: "/jobs/create", label: "Đăng tin tuyển thợ", stat: `${user?.jobs?.length ?? 0} tin đang mở`, icon: PlusCircle, tone: "bg-pink-500/15 text-pink-300" }
      : { href: "/tools/income-tracker", label: "Thu nhập & tip", stat: income === null ? "Ghi turn + tip mỗi tối" : `Tuần này: $${income.toLocaleString("en-US")}`, icon: Wallet, tone: "bg-violet-500/15 text-violet-300" };

  return [
    { href: "/messages", label: "Tin nhắn", stat: unreadCount > 0 ? `${unreadCount} tin chưa đọc` : "Chat với tiệm & thợ", icon: MessageCircle, tone: "bg-sky-500/15 text-sky-300", badge: unreadCount },
    roleTool,
    { href: "/tools/radar", label: "Nail Radar", stat: radarStat, icon: Radar, tone: "bg-amber-500/15 text-amber-300" },
    { href: "/supply", label: "Kho hàng vật tư", stat: "Vật tư giá sỉ từ các tiệm", icon: ShoppingBag, tone: "bg-emerald-500/15 text-emerald-300" },
  ];
}

// variant "list": khối dọc trong Sidebar desktop · "row": hàng thẻ vuốt
// ngang trên trang chủ mobile (trước đây mobile không có lối tắt công cụ).
export default function ToolsPanel({ variant }: { variant: "list" | "row" }) {
  const tools = useTools();

  if (variant === "row") {
    return (
      <nav aria-label="Công cụ" className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
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
    <nav aria-label="Công cụ" className="space-y-1">
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
