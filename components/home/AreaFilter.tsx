"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MapPin, Search, X } from "lucide-react";
import Flag from "@/components/ui/Flag";
import { stateName } from "@/lib/stateNames";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// V2.1 (điện thoại, trong app): bộ lọc khu vực gập vào hàng tab dính — 1 nút nhỏ [cờ · bang] cạnh Bảng tin/Việc/Thợ,
// bấm mở sheet (thị trường · bang · thành phố). Trước đây thẻ lọc riêng ~60px đẩy băng-rôn mùa + bài đầu tiên xuống
// dưới màn hình đầu. Trang khách "/" (classic) và máy tính giữ bộ lọc cũ (app/page.tsx).
export default function AreaFilter({
  market,
  state,
  city,
  states,
  tab,
  onMarket,
  onState,
  onCity,
}: {
  market: "US" | "AU";
  state: string;
  city: string;
  states: string[];
  tab: "feed" | "jobs" | "portfolio";
  onMarket: (m: "US" | "AU") => void;
  onState: (s: string) => void;
  onCity: (c: string) => void;
}) {
  useTr();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const active = !!state || !!city;

  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      btnRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const label = city ? city : state ? state : market === "US" ? tr("Mỹ", "US") : tr("Úc", "AU");
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${tr("Lọc theo khu vực", "Filter by area")}: ${[market === "US" ? tr("Mỹ", "US") : tr("Úc", "AU"), state ? stateName(market, state) : tr("Tất cả bang", "All states"), city].filter(Boolean).join(" · ")}`}
        className={`pn-area-btn flex h-12 max-w-[96px] flex-shrink-0 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-semibold ${active ? "pn-area-on" : ""}`}
      >
        <Flag code={market} className="h-3 w-4" />
        <span className="min-w-0 truncate">{label}</span>
      </button>

      {/* Cổng ra <body>: thanh tab dính là 1 lớp xếp chồng z-30 — sheet ở trong đó sẽ nằm DƯỚI dock / thanh trên */}
      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 md:hidden" onClick={() => setOpen(false)}>
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={tr("Lọc theo khu vực", "Filter by area")}
            className="pn-sheet w-full rounded-t-[24px] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span aria-hidden className="mx-auto mb-3 block h-1 w-9 rounded-full bg-white/20" />
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-semibold text-pn-text">{tr("Lọc theo khu vực", "Filter by area")}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label={tr("Đóng", "Close")} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-pn-text-2">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={tr("Thị trường", "Market")}>
              {(["US", "AU"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={market === m}
                  onClick={() => {
                    if (m === market) return;
                    onMarket(m);
                    onState("");
                  }}
                  className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold ${market === m ? "bg-pn-thumb text-pn-text ring-1 ring-inset ring-white/[0.08]" : "bg-white/[0.04] text-pn-text-2 ring-1 ring-inset ring-pn-line"}`}
                >
                  <Flag code={m} className="h-3.5 w-5" />
                  {m === "US" ? tr("Mỹ · US", "United States") : tr("Úc · AU", "Australia")}
                </button>
              ))}
            </div>

            <p className="mt-4 text-[13px] text-pn-text-3">{tr("Bang", "State")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["", ...states].map((s) => (
                <button
                  key={s || "all"}
                  type="button"
                  aria-pressed={state === s}
                  onClick={() => onState(s)}
                  className={`flex min-h-10 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold ${state === s ? "bg-pn-text text-pn-canvas" : "bg-white/[0.04] text-pn-text-2 ring-1 ring-inset ring-pn-line"}`}
                >
                  {state === s && <Check className="h-3.5 w-3.5" aria-hidden />}
                  {s ? stateName(market, s) : tr("Tất cả bang", "All states")}
                </button>
              ))}
            </div>

            <div className="relative mt-4">
              <Search aria-hidden className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pn-text-3" />
              <input
                type="text"
                value={city}
                onChange={(e) => onCity(e.target.value)}
                placeholder={tab === "jobs" ? tr("Tìm thành phố, tên tiệm, kỹ năng…", "Search city, salon, skill…") : tr("Thành phố… (VD: Houston, Sydney)", "City… (e.g. Houston, Sydney)")}
                aria-label={tr("Tìm theo thành phố", "Search by city")}
                className="input-field w-full !rounded-2xl py-2.5 pl-10 pr-10"
              />
              {city && (
                <button type="button" onClick={() => onCity("")} aria-label={tr("Xoá tìm kiếm", "Clear search")} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-pn-text-3">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {active && (
                <button
                  type="button"
                  onClick={() => {
                    onState("");
                    onCity("");
                  }}
                  className="flex h-12 items-center gap-1.5 rounded-2xl px-4 text-[15px] font-semibold text-pn-text-2"
                >
                  <MapPin className="h-4 w-4" aria-hidden />
                  {tr("Tất cả bang", "All states")}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="ml-auto h-12 flex-1 rounded-2xl bg-pn-brand px-6 text-[15px] font-semibold text-white">
                {tr("Xong", "Done")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
