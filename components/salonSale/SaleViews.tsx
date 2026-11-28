"use client";

// Thẻ + bảng số liệu của tin SANG TIỆM (mục Sang tiệm). Dùng chung cho danh sách / trang tin / khối giới thiệu.
import Link from "next/link";
import { Armchair, Building2, DollarSign, Hand, MapPin, Ruler, TrendingUp, Users2 } from "lucide-react";
import { placeLabel } from "@/lib/stateNames";
import { formatMoney } from "@/lib/salonSale/parse";
import { timeAgo } from "@/lib/feedFormat";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import type { PublicSale } from "@/lib/salonSale/store";

/** Tiêu đề hiển thị: bài từ nhóm → tiêu đề chuẩn theo ngôn ngữ; tin tự đăng → tiêu đề người bán. */
export function saleTitle(s: Pick<PublicSale, "title" | "fromGroup">) {
  if (s.fromGroup) return /gấp/.test(s.title) ? tr("Sang tiệm nail gấp", "Nail salon for sale, urgent") : tr("Sang tiệm nail", "Nail salon for sale");
  return s.title;
}

export const salePlace = (s: Pick<PublicSale, "city" | "market" | "state">) => placeLabel(s.city, s.market, s.state);

/** Số liệu chính: giá sang, tiền thuê, doanh thu, ghế, bàn, diện tích — chỉ những ô có số. */
export function saleFacts(s: Pick<PublicSale, "askingPrice" | "monthlyRent" | "monthlyRevenue" | "chairs" | "tables" | "sqft" | "market">) {
  const out: { key: string; icon: typeof DollarSign; label: string; value: string }[] = [];
  if (s.monthlyRevenue != null) out.push({ key: "rev", icon: TrendingUp, label: tr("Doanh thu / tháng", "Revenue / month"), value: formatMoney(s.monthlyRevenue, s.market) });
  if (s.monthlyRent != null) out.push({ key: "rent", icon: Building2, label: tr("Tiền thuê / tháng", "Rent / month"), value: formatMoney(s.monthlyRent, s.market) });
  if (s.chairs != null) out.push({ key: "chairs", icon: Armchair, label: tr("Ghế spa", "Pedicure chairs"), value: String(s.chairs) });
  if (s.tables != null) out.push({ key: "tables", icon: Hand, label: tr("Bàn làm tay", "Nail tables"), value: String(s.tables) });
  if (s.sqft != null) out.push({ key: "sqft", icon: Ruler, label: tr("Diện tích", "Size"), value: `${s.sqft.toLocaleString("en-US")} sqft` });
  return out;
}

export function SalePrice({ s, className = "" }: { s: Pick<PublicSale, "askingPrice" | "market">; className?: string }) {
  return (
    <span className={`font-black tabular-nums ${className}`} data-sale-price>
      {s.askingPrice != null ? formatMoney(s.askingPrice, s.market) : tr("Giá thương lượng", "Price on request")}
    </span>
  );
}

export function SaleCard({ s }: { s: PublicSale }) {
  useTr(); // render lại khi đổi VI/EN
  const facts = saleFacts(s).slice(0, 3);
  const cover = s.media[0];
  return (
    <Link href={`/salons-for-sale/${s.id}`} data-sale-card={s.id} className="glass-card group flex min-w-0 flex-col overflow-hidden rounded-2xl transition-colors hover:border-pink-500/40">
      {cover ? (
        <span className="relative block aspect-[16/9] w-full overflow-hidden bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          {s.status === "sold" && <span className="absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-bold text-white">{tr("Đã sang", "Sold")}</span>}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="line-clamp-2 block text-base font-bold leading-snug text-white">{saleTitle(s)}</span>
            {s.salonName && <span className="block truncate text-sm font-semibold text-slate-400">{s.salonName}</span>}
          </span>
          <SalePrice s={s} className="shrink-0 text-right text-lg text-pink-200" />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-slate-300">
          <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate">{salePlace(s)}</span>
        </span>
        {facts.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {facts.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                <f.icon className="h-3.5 w-3.5 text-slate-400" /> {f.value} <span className="font-normal text-slate-400">{f.label.toLowerCase()}</span>
              </span>
            ))}
          </span>
        )}
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-slate-500">
          <span>{timeAgo(s.createdAt)}</span>
          {s.fromGroup && <><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><Users2 className="h-3.5 w-3.5" /> {tr("Từ nhóm cộng đồng PawNail", "From PawNail community groups")}</span></>}
        </span>
      </span>
    </Link>
  );
}
