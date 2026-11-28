"use client";

// SANG TIỆM — danh sách tiệm nail đang sang / bán (tin chủ tiệm tự đăng + bài từ nhóm cộng đồng PawNail).
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Store } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Flag from "@/components/ui/Flag";
import { SaleCard } from "@/components/salonSale/SaleViews";
import { useSessionUser } from "@/lib/SessionUserContext";
import { stateName } from "@/lib/stateNames";
import { useTr } from "@/lib/i18n/useTr";
import type { PublicSale } from "@/lib/salonSale/store";

type Market = "US" | "AU";
interface ListResp { sales: PublicSale[]; total: number; nextCursor: string | null; states: { state: string; n: number }[] }

const PRICE_STEPS = [50_000, 100_000, 150_000, 250_000, 500_000];

export default function SalonsForSalePage() {
  const { tr } = useTr();
  const { user } = useSessionUser();
  // Thị trường mặc định theo hồ sơ (tiệm ở Úc thấy tin Úc) cho tới khi người xem tự chọn
  const [marketPick, setMarket] = useState<Market | null>(null);
  const market: Market = marketPick ?? (user?.market === "AU" ? "AU" : "US");
  const [state, setState] = useState("");
  const [maxPrice, setMaxPrice] = useState(0);
  const [sort, setSort] = useState<"new" | "price">("new");
  // Kết quả gắn với bộ lọc đã tải: bộ lọc đổi → đang tải tới khi kết quả của bộ lọc mới về (không setState trong effect)
  const key = `${market}|${state}|${maxPrice}|${sort}`;
  const [res, setRes] = useState<{ key: string; data: ListResp | null } | null>(null);
  const loading = res?.key !== key;
  const data = loading ? null : res!.data;
  const [more, setMore] = useState(false);

  const query = useCallback(
    (cursor?: string) => {
      const q = new URLSearchParams({ market, sort });
      if (state) q.set("state", state);
      if (maxPrice) q.set("maxPrice", String(maxPrice));
      if (cursor) q.set("cursor", cursor);
      return fetch(`/api/salon-sales?${q}`).then((r) => (r.ok ? (r.json() as Promise<ListResp>) : null)).catch(() => null);
    },
    [market, state, maxPrice, sort],
  );

  useEffect(() => {
    let live = true;
    query().then((d) => {
      if (live) setRes({ key, data: d });
    });
    return () => {
      live = false;
    };
  }, [query, key]);

  const loadMore = async () => {
    if (!data?.nextCursor || more) return;
    setMore(true);
    const d = await query(data.nextCursor);
    if (d) setRes((prev) => (prev?.data ? { key: prev.key, data: { ...d, sales: [...prev.data.sales, ...d.sales], states: prev.data.states } } : prev));
    setMore(false);
  };

  const canPost = !user || user.role === "OWNER" || user.role === "ADMIN";
  const sel = "input-field !h-11 !py-0 text-sm";

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 md:pb-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-white">{tr("Sang tiệm nail", "Nail salons for sale")}</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              {tr("Tiệm nail đang sang / bán: giá sang, tiền thuê, doanh thu, số ghế. Gọi hoặc nhắn tin thẳng cho chủ tiệm, không qua trung gian.", "Nail salons for sale with asking price, rent, revenue and chairs. Call or message the owner directly, no broker.")}
            </p>
          </div>
          {canPost && (
            <Link href={user ? "/salons-for-sale/new" : "/auth/login?callbackUrl=%2Fsalons-for-sale%2Fnew"} data-sale-post className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-pink-600 px-4 text-sm font-bold text-white hover:bg-pn-brand-hover">
              <Plus className="h-4 w-4" /> {tr("Đăng tin sang tiệm", "List your salon")}
            </Link>
          )}
        </header>

        <section aria-label={tr("Bộ lọc", "Filters")} className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1">
            {(["US", "AU"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={market === m} onClick={() => { setMarket(m); setState(""); }} className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-sm font-bold ring-[1.5px] ${market === m ? "bg-white/[0.04] text-white ring-pink-400" : "text-slate-400 ring-white/10"}`}>
                <Flag code={m} /> {m === "US" ? tr("Mỹ", "US") : tr("Úc", "Australia")}
              </button>
            ))}
          </div>
          <label className="min-w-0">
            <span className="sr-only">{tr("Bang", "State")}</span>
            <select value={state} onChange={(e) => setState(e.target.value)} className={sel} data-sale-filter="state">
              <option value="">{tr("Tất cả bang", "All states")}</option>
              {(data?.states ?? []).map((s) => <option key={s.state} value={s.state}>{stateName(market, s.state)} ({s.n})</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">{tr("Giá tối đa", "Max price")}</span>
            <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className={sel} data-sale-filter="price">
              <option value={0}>{tr("Mọi mức giá", "Any price")}</option>
              {PRICE_STEPS.map((p) => <option key={p} value={p}>{tr(`Dưới $${p / 1000}K`, `Under $${p / 1000}K`)}</option>)}
            </select>
          </label>
          <label className="col-span-2 min-w-0 sm:col-span-1">
            <span className="sr-only">{tr("Sắp xếp", "Sort")}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value === "price" ? "price" : "new")} className={sel} data-sale-filter="sort">
              <option value="new">{tr("Mới đăng trước", "Newest first")}</option>
              <option value="price">{tr("Giá thấp trước", "Lowest price first")}</option>
            </select>
          </label>
        </section>

        <p className="mt-4 text-sm text-slate-400" aria-live="polite">
          {loading ? tr("Đang tải…", "Loading…") : tr(`${data?.total ?? 0} tiệm đang sang`, `${data?.total ?? 0} salon${(data?.total ?? 0) === 1 ? "" : "s"} for sale`)}
        </p>

        {loading ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/[0.04]" />)}
          </div>
        ) : data && data.sales.length ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.sales.map((s) => <SaleCard key={s.id} s={s} />)}
            </div>
            {data.nextCursor && (
              <div className="mt-5 flex justify-center">
                <button type="button" onClick={loadMore} disabled={more} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 text-sm font-bold text-slate-200 ring-1 ring-white/15 hover:bg-white/5">
                  {more && <Loader2 className="h-4 w-4 animate-spin" />} {tr("Xem thêm", "Show more")}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="glass-card mt-3 flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center" data-sale-empty>
            <Store className="h-8 w-8 text-slate-500" />
            <p className="font-bold text-white">{state || maxPrice ? tr("Chưa có tiệm nào khớp bộ lọc", "No salons match these filters") : tr("Chưa có tin sang tiệm nào", "No salons listed yet")}</p>
            <p className="max-w-sm text-sm text-slate-400">{tr("Muốn sang tiệm? Đăng tin miễn phí — thợ và chủ tiệm khắp nơi đang tìm tiệm để mua.", "Selling your salon? List it for free. Owners and techs everywhere are looking for a salon to buy.")}</p>
            {(state || maxPrice) ? (
              <button type="button" onClick={() => { setState(""); setMaxPrice(0); }} className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-pink-300 ring-1 ring-pink-500/30">{tr("Xoá bộ lọc", "Clear filters")}</button>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
