"use client";

// Trang chủ cho KHÁCH CHƯA ĐĂNG NHẬP (tab "Khám phá"): thử mẫu trên tay, tiệm quanh bạn, mẫu nail mới.
// Người mới — phần lớn là khách đi làm nail nói tiếng Anh — thấy ngay thứ dùng được, thay vì bảng tin
// cộng đồng (nhiều bài do thành viên viết bằng tiếng Việt). Việc làm & thợ sẵn sàng vẫn chỉ cách một tab.
// Khối tĩnh (thử mẫu, ảnh có kích thước cố định) ở trên; khối tải sau (tiệm, mẫu) ở dưới → không giật bố cục.
import React from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Wand2 } from "lucide-react";
import { DesignsStrip } from "@/components/designs/DesignViews";
import SalonDirectory from "@/components/client/SalonDirectory";
import { stateName } from "@/lib/stateNames";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function GuestDiscover({ market, state }: { market: "US" | "AU"; state: string }) {
  useTr();
  return (
    <div className="space-y-6" data-testid="guest-discover">
      <Link href="/tryon" className="group block overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600/30 via-pink-600/20 to-violet-600/15 ring-1 ring-pink-400/30 sm:grid sm:grid-cols-[1.1fr_1fr]">
        <div className="relative grid grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tryon/teaser-before.jpg" alt={tr("Trước khi thử mẫu", "Before try-on")} width={416} height={320} loading="lazy" className="aspect-[13/10] h-full w-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tryon/teaser-after.jpg" alt={tr("Sau khi thử mẫu", "After try-on")} width={416} height={320} loading="lazy" className="aspect-[13/10] h-full w-full object-cover" />
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">{tr("Trước", "Before")}</span>
          <span className="absolute right-2 top-2 rounded-full bg-pink-600/90 px-2 py-0.5 text-[10px] font-bold text-white">{tr("Thử mẫu", "Try-On")}</span>
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/70" aria-hidden />
        </div>
        <span className="flex flex-col justify-center gap-2 p-4 sm:p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-pink-200/90">PawNail Try-On</span>
          <span className="text-lg font-black leading-snug text-white">{tr("Thử mẫu trước khi đặt lịch", "Try it on before you book")}</span>
          <span className="text-sm leading-relaxed text-white/75">{tr("Chụp một ảnh bàn tay, xem 10 mẫu gợi ý trên chính móng của bạn. Xử lý ngay trên điện thoại.", "Take one photo of your hand and see 10 suggested looks on your own nails. It runs on your phone.")}</span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-pink-200 group-hover:text-white">
            <Wand2 className="h-4 w-4" />{tr("Chụp ảnh bàn tay", "Take a photo of your hand")}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>

      <section className="space-y-3" aria-labelledby="guest-salons">
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 id="guest-salons" className="flex items-center gap-2 text-base font-black text-white"><MapPin className="h-4 w-4 text-pink-300" />{tr("Tiệm nail gần bạn", "Salons near you")}{state ? ` · ${stateName(market, state)}` : ""}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{tr("Xem tác phẩm thật, menu và giá, rồi gửi yêu cầu đặt lịch.", "Browse real work, menus and prices, then request a booking.")}</p>
          </div>
          <Link href="/salons" className="flex flex-shrink-0 items-center gap-0.5 text-xs font-bold text-pink-300 hover:underline">{tr("Tìm tiệm", "Find a salon")}<ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <SalonDirectory market={market} state={state} limit={4} compact />
      </section>

      <DesignsStrip />
    </div>
  );
}
