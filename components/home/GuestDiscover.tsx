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
import { imageLabel } from "@/lib/imageLabel";

export default function GuestDiscover({ market, state }: { market: "US" | "AU"; state: string }) {
  const { locale } = useTr();
  return (
    <div className="space-y-6" data-testid="guest-discover">
      <Link href="/tryon" className="group block overflow-hidden rounded-[24px] bg-pn-surface shadow-[inset_0_0_0_1px_var(--color-pn-line)] sm:grid sm:grid-cols-[1.1fr_1fr]">
        <div className="relative grid grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tryon/teaser-before.jpg" alt={tr("Trước khi thử mẫu", "Before try-on")} width={416} height={320} loading="lazy" className="aspect-[13/10] h-full w-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tryon/teaser-after.jpg" alt={tr("Sau khi thử mẫu", "After try-on")} width={416} height={320} loading="lazy" className="aspect-[13/10] h-full w-full object-cover" />
          <span className="absolute left-3 top-3 inline-flex h-[22px] items-center rounded-full bg-[rgb(12_7_14/0.72)] px-2 font-semibold text-[#f6f0f5] shadow-[inset_0_0_0_1px_rgb(255_240_246/0.12)]" style={{ fontSize: 12, lineHeight: "16px" }}>{tr("Trước", "Before")}</span>
          <span className="absolute right-3 top-3 inline-flex h-[22px] items-center rounded-full bg-[rgb(12_7_14/0.72)] px-2 font-semibold text-[#f6f0f5] shadow-[inset_0_0_0_1px_rgb(255_240_246/0.12)]" style={{ fontSize: 12, lineHeight: "16px" }}>{tr("Thử mẫu", "Try-On")}</span>
          <span className="absolute bottom-3 left-3 inline-flex h-[22px] items-center rounded-full bg-[rgb(12_7_14/0.72)] px-2 font-semibold text-[#f6f0f5] shadow-[inset_0_0_0_1px_rgb(255_240_246/0.12)]" style={{ fontSize: 12, lineHeight: "16px" }} data-image-label>{imageLabel("render", locale === "vi" ? "vi" : "en")}</span>
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/70" aria-hidden />
        </div>
        <span className="flex flex-col justify-center gap-2 p-4 sm:p-5">
          <span className="text-[12px] font-semibold text-pn-text-3" style={{ fontSize: 12, lineHeight: "16px" }}>{tr("PawNail Thử mẫu", "PawNail Try-On")}</span>
          <span className="text-[17px] font-semibold leading-[22px] text-[#f6f0f5]">{tr("Thử mẫu trước khi đặt lịch", "Try it on before you book")}</span>
          <span className="text-[15px] leading-[22px] text-[#c2b7bf]">{tr("Chụp một ảnh bàn tay, xem 10 mẫu gợi ý trên chính móng của bạn. Xử lý ngay trên điện thoại.", "Take one photo of your hand and see 10 suggested looks on your own nails. It runs on your phone.")}</span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#f59bbe] group-hover:text-white">
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
