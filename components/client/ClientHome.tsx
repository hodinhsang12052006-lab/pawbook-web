"use client";

// Trang chủ của KHÁCH đi làm nail — thế giới riêng, KHÔNG có việc làm / tuyển thợ / tin ngành.
// Vòng giữ chân (học từ Booksy, StyleSeat, Pinterest): cảm hứng mẫu → tìm chỗ làm gần → đặt lịch / nhắn hỏi
// → lưu mẫu → quay lại lần sau. Mỗi khối đều dẫn tới 1 hành động, không khối nào chỉ để đọc.
import React from "react";
import Link from "next/link";
import { Bookmark, CalendarHeart, Lightbulb, MapPin, Sparkles, Store, Wand2 } from "lucide-react";
import { DesignsStrip } from "@/components/designs/DesignViews";
import MenuShowcase from "@/components/designs/MenuShowcase";
import SalonDirectory from "@/components/client/SalonDirectory";
import { clientTipOfDay } from "@/lib/clientTips";
import { stateName } from "@/lib/stateNames";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function ClientHome({ user }: { user: { id: string; name?: string | null; market?: "US" | "AU"; state?: string | null } }) {
  useTr();
  const market = user.market === "AU" ? "AU" : "US";
  const state = user.state || "";
  const first = (user.name || "").trim().split(/\s+/).pop() || "";
  const tip = clientTipOfDay();
  const tiles = [
    { href: "/designs", icon: Sparkles, title: tr("Mẫu trend", "Trending looks"), sub: tr("Ý tưởng mới mỗi ngày", "New ideas daily"), tone: "from-pink-500/25 to-fuchsia-500/10 text-pink-200" },
    { href: "/salons", icon: Store, title: tr("Tiệm gần bạn", "Salons near you"), sub: state ? stateName(market, state) : tr("Xem giá & ảnh thật", "Real photos & prices"), tone: "from-amber-500/25 to-orange-500/10 text-amber-200" },
    { href: "/designs?saved=1", icon: Bookmark, title: tr("Mẫu đã lưu", "Saved looks"), sub: tr("Đưa thợ xem ngay", "Show your tech"), tone: "from-violet-500/25 to-sky-500/10 text-violet-200" },
  ];
  return (
    <div className="space-y-6">
      <header className="px-1">
        <h1 className="text-xl font-black tracking-tight text-white">{tr(`Chào ${first || "bạn"} 💅`, `Hi ${first || "there"} 💅`)}</h1>
        <p className="mt-0.5 text-sm text-slate-400">{tr("Hôm nay muốn làm móng kiểu gì?", "What look are you in the mood for?")}</p>
      </header>

      {/* THỬ MẪU TRÊN TAY — lý do số 1 để khách mở app khi đang phân vân làm mẫu gì: ảnh trước / sau THẬT do bộ máy vẽ */}
      <Link href="/tryon" className="group block overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600/30 via-pink-600/20 to-amber-500/15 ring-1 ring-pink-400/30" data-testid="tryon-hero">
        <div className="relative grid grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tryon/teaser-before.jpg" alt={tr("Trước", "Before")} width={416} height={320} className="aspect-[13/10] w-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tryon/teaser-after.jpg" alt={tr("Sau khi thử mẫu", "After try-on")} width={416} height={320} className="aspect-[13/10] w-full object-cover" />
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">{tr("Trước", "Before")}</span>
          <span className="absolute right-2 top-2 rounded-full bg-pink-600/90 px-2 py-0.5 text-[10px] font-bold text-white">{tr("Thử mẫu", "Try-on")}</span>
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/70" aria-hidden />
        </div>
        <span className="flex items-center gap-3 p-3.5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-pink-600/30"><Wand2 className="h-5 w-5 text-white" /></span>
          <span className="min-w-0">
            <span className="block text-[15px] font-black text-white">{tr("Chụp tay — xem mẫu hợp với BẠN", "Snap your hand — see looks made for YOU")}</span>
            <span className="block text-xs text-white/70">{tr("Máy tự nhận móng, soi tông da + dáng móng, vẽ 10 mẫu trend lên chính móng bạn", "We find your nails, read your skin tone + nail shape, and paint 10 trending looks on them")}</span>
          </span>
        </span>
      </Link>

      <nav aria-label={tr("Lối tắt", "Shortcuts")} className="grid grid-cols-3 gap-2.5">
        {tiles.map(({ href, icon: Icon, title, sub, tone }) => (
          <Link key={href} href={href} className={`flex min-h-[104px] flex-col justify-between rounded-3xl bg-gradient-to-br p-3.5 ring-1 ring-white/10 transition active:scale-[0.98] ${tone}`}>
            <Icon className="h-6 w-6" />
            <span>
              <span className="block text-sm font-black text-white">{title}</span>
              <span className="block truncate text-[11px] text-white/60">{sub}</span>
            </span>
          </Link>
        ))}
      </nav>

      <DesignsStrip />

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="flex items-center gap-2 text-base font-black text-white"><MapPin className="h-4 w-4 text-amber-300" />{tr("Tiệm & thợ quanh bạn", "Salons & techs near you")}</h2>
          <Link href="/salons" className="text-xs font-bold text-pink-300">{tr("Xem tất cả →", "See all →")}</Link>
        </div>
        <SalonDirectory market={market} state={state} limit={4} compact />
      </section>

      <MenuShowcase />

      <section className="flex gap-3 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-sky-500/5 p-4 ring-1 ring-emerald-400/20">
        <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300">{tr("Mẹo giữ móng đẹp hôm nay", "Today's nail-care tip")}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">{tr(tip.vi, tip.en)}</p>
        </div>
      </section>

      <Link href="/salons" className="flex items-center gap-3 rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
        <CalendarHeart className="h-6 w-6 flex-shrink-0 text-pink-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-white">{tr("Đặt lịch không cần gọi điện", "Book without calling")}</span>
          <span className="block text-xs text-slate-400">{tr("Chọn dịch vụ trên menu tiệm, chọn ngày giờ — tiệm xác nhận qua tin nhắn.", "Pick a service from the menu, choose a time — the salon confirms by text.")}</span>
        </span>
      </Link>
    </div>
  );
}
