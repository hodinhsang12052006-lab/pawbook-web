"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, MessageCircle, Store } from "lucide-react";

export interface SupplyProductType {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  createdAt: string;
  seller: { id: string; name: string; avatarUrl: string | null; city: string | null; state: string | null };
}

const PRESS = "active:scale-95 transition-transform duration-100";

function formatUSD(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Thẻ sản phẩm xen kẽ trong newsfeed — cố tình thiết kế khác hẳn FeedPostCard
// (khung viền vàng/hổ phách thay vì viền xám trung tính) để mắt phân biệt
// ngay đây là nội dung thương mại, không lẫn với bài đăng cá nhân.
export default function SupplyProductCard({ product }: { product: SupplyProductType }) {
  const router = useRouter();

  return (
    <article className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.04] via-slate-900/30 to-slate-900/30 overflow-hidden">
      <div className="relative aspect-[16/10] bg-slate-950">
        <Image
          src={product.imageUrl}
          alt={product.title}
          fill
          loading="lazy"
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover"
        />
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-amber-950 shadow">
          <Package className="h-3 w-3" /> Hàng Sỉ Tiệm Nail
        </span>
        {product.discountPercent && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black text-white shadow">
            -{product.discountPercent}%
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{product.title}</h3>
          {product.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-amber-400">{formatUSD(product.price)}</span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-sm text-slate-500 line-through">{formatUSD(product.originalPrice)}</span>
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
            onClick={() => router.push(`/messages?to=${product.seller.id}`)}
            className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold text-amber-950 ${PRESS}`}
          >
            <MessageCircle className="h-4 w-4" /> Nhắn tin mua sỉ
          </button>
          <Link
            href="/supply"
            className={`flex-1 min-h-[44px] flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-sm font-bold text-slate-200 ${PRESS}`}
          >
            Xem kho hàng
          </Link>
        </div>
      </div>
    </article>
  );
}
