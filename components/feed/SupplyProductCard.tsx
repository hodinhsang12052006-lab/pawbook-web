"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { localeHref } from "@/lib/i18n/localeHref";
import { Package, MessageCircle, Store } from "lucide-react";
import { currentLocale, tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { dt } from "@/lib/i18n/dataEn";

export interface SupplyProductType {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  createdAt: string;
  seller: { id: string; name: string; avatarUrl: string | null; city: string | null; state: string | null; market?: "US" | "AU" | null };
  titleEn?: string | null;
  titleVi?: string | null;
}

const PRESS = "active:scale-95 transition-transform duration-100";

// Giá ghi rõ đơn vị tiền: "US$17.00" / "A$17.00" — "$17.00" trơn dễ hiểu nhầm giữa Mỹ và Úc.
function formatPrice(n: number, market?: string | null) {
  return `${market === "AU" ? "A$" : "US$"}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/** Tên sản phẩm theo ngôn ngữ người xem (alt ảnh cũng dùng tên này — VoiceOver không đọc tiếng Việt cho khách Mỹ). */
export function supplyTitle(p: Pick<SupplyProductType, "title" | "titleEn" | "titleVi">): string {
  return (currentLocale() === "en" ? p.titleEn || dt(p.title) : p.titleVi || p.title) || p.title;
}

// Thẻ sản phẩm xen kẽ trong newsfeed — cố tình thiết kế khác hẳn FeedPostCard
// (khung viền vàng/hổ phách thay vì viền xám trung tính) để mắt phân biệt
// ngay đây là nội dung thương mại, không lẫn với bài đăng cá nhân.
export default function SupplyProductCard({ product, compact = false }: { product: SupplyProductType; compact?: boolean }) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();

  // Bản gọn trong bảng tin: 1 hàng ngang (ảnh nhỏ + tên + giá) — thẻ to chiếm cả
  // màn hình điện thoại làm bảng tin nhìn như trang quảng cáo.
  if (compact) {
    return (
      <article className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.06] to-slate-900/30 p-2.5">
        <Link href="/supply" className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-950">
          <Image src={product.imageUrl} alt={supplyTitle(product)} fill loading="lazy" sizes="80px" className="object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400">
            <Package className="h-3 w-3" />{tr(" Chợ vật tư", " Supply exchange")}
          </p>
          <Link href="/supply" className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-white hover:text-amber-100">{supplyTitle(product)}</Link>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base font-black text-amber-400">{formatPrice(product.price, product.seller.market)}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-xs text-slate-500 line-through">{formatPrice(product.originalPrice, product.seller.market)}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(localeHref(`/messages?to=${product.seller.id}`))}
          aria-label={tr("Nhắn tin người bán", "Message the seller")}
          className={`flex h-11 flex-shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3 text-xs font-bold text-amber-950 hover:bg-amber-400 ${PRESS}`}
        >
          <MessageCircle className="h-4 w-4" />{product.price > 0 ? tr("Nhắn tin", "Message") : tr("Hỏi giá", "Ask price")}
        </button>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.04] via-slate-900/30 to-slate-900/30 overflow-hidden">
      <div className="relative aspect-[16/10] bg-slate-950">
        <Image
          src={product.imageUrl}
          alt={supplyTitle(product)}
          fill
          loading="lazy"
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover"
        />
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-amber-950 shadow">
          <Package className="h-3 w-3" />{tr(" Chợ vật tư", " Supply exchange")}
        </span>
        {product.discountPercent && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white shadow">
            -{product.discountPercent}%
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{supplyTitle(product)}</h3>
          {product.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{dt(product.description)}</p>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-amber-400">{formatPrice(product.price, product.seller.market)}</span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-sm text-slate-500 line-through">{formatPrice(product.originalPrice, product.seller.market)}</span>
          )}
        </div>

        <Link
          href={`/profile/${product.seller.id}`}
          className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Store className="h-3.5 w-3.5" />
          {product.seller.name}
          {(product.seller.city || product.seller.state) && (
            <span>· {[product.seller.city, product.seller.state].filter(Boolean).join(", ")}</span>
          )}
        </Link>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => router.push(localeHref(`/messages?to=${product.seller.id}`))}
            className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold text-amber-950 ${PRESS}`}
          >
            <MessageCircle className="h-4 w-4" />{tr(" Nhắn tin người bán", " Message the seller")}
          </button>
          <Link
            href="/supply"
            className={`flex-1 min-h-[44px] flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-sm font-bold text-slate-200 ${PRESS}`}
          >
            {tr("Xem thêm hàng của tiệm", "More from this seller")}
          </Link>
        </div>
      </div>
    </article>
  );
}
