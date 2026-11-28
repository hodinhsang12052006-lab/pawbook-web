"use client";

// Dải "Sang tiệm" trên bảng Việc làm: số tiệm đang sang ở khu vực đang xem (số thật) → /salons-for-sale.
// Chưa có tin nào: chủ tiệm thấy lời mời đăng tin; thợ / khách không thấy gì.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { stateName } from "@/lib/stateNames";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function SaleStrip({ market, state, isOwner }: { market: "US" | "AU"; state: string; isOwner: boolean }) {
  useTr(); // render lại khi đổi VI/EN
  const [got, setGot] = useState<{ key: string; total: number } | null>(null);
  const key = `${market}|${state}`;
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ market, ...(state ? { state } : {}) });
    fetch(`/api/salon-sales?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (live) setGot({ key, total: Number(d?.total) || 0 });
      });
    return () => {
      live = false;
    };
  }, [market, state, key]);

  const total = got?.key === key ? got.total : null;
  if (total === null || (total === 0 && !isOwner)) return null;
  const scope = state ? stateName(market, state) : market === "US" ? tr("Mỹ", "the US") : tr("Úc", "Australia");
  const href = total === 0 ? "/salons-for-sale/new" : "/salons-for-sale";
  return (
    <Link href={href} data-sale-strip className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5 text-sm transition-colors hover:border-amber-400/40">
      <Store className="h-5 w-5 shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1 text-slate-200">
        {total > 0 ? (
          <><span className="font-black text-amber-200">{tr(`${total} tiệm đang sang`, `${total} salon${total === 1 ? "" : "s"} for sale`)}</span>{tr(` tại ${scope}`, ` in ${scope}`)}</>
        ) : (
          <><span className="font-bold text-amber-200">{tr("Muốn sang tiệm?", "Selling your salon?")}</span> {tr("Đăng tin miễn phí ở mục Sang tiệm", "List it for free in Salons for sale")}</>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}
