"use client";

// Trang công khai cho KHÁCH đi làm nail: tìm tiệm / thợ theo bang, xem ảnh thật + giá + đánh giá, đặt lịch.
import React, { useEffect, useState } from "react";
import { MapPin, Store } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import SalonDirectory from "@/components/client/SalonDirectory";
import Flag from "@/components/ui/Flag";
import { useSessionUser } from "@/lib/SessionUserContext";
import { US_STATES, AU_STATES } from "@/lib/nailRadarData";
import { stateName } from "@/lib/stateNames";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function SalonsPage() {
  useTr();
  const { user } = useSessionUser();
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("");
  const [look, setLook] = useState("");
  useEffect(() => {
    if (user?.market === "AU" || user?.market === "US") setMarket(user.market);
    if (user?.state) setState(user.state);
  }, [user?.market, user?.state]);
  useEffect(() => { try { setLook(new URL(window.location.href).searchParams.get("look") || ""); } catch {} }, []);
  const states = market === "US" ? US_STATES : AU_STATES;
  const chip = (on: boolean) => `min-h-[36px] flex-shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm font-bold transition ${on ? "bg-pink-600 text-white" : "bg-white/[0.05] text-slate-300 ring-1 ring-white/10"}`;

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 pb-28">
        <header className="space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 px-3 py-1 text-xs font-bold text-pink-300 ring-1 ring-pink-500/25"><Store className="h-3.5 w-3.5" />{tr("Dành cho khách làm nail", "For nail clients")}</p>
          <h1 className="text-2xl font-black tracking-tight text-white [text-wrap:balance]">{tr("Tiệm & thợ nail quanh bạn", "Nail salons & techs near you")}</h1>
          <p className="text-sm text-slate-400 [text-wrap:pretty]">{tr("Xem ảnh tác phẩm thật, bảng giá và đánh giá của khách trước khi đặt lịch — nhắn hỏi mẫu trực tiếp, miễn phí.", "See real work, prices and client reviews before you book — message salons directly, free.")}</p>
          {look && <p className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-200 ring-1 ring-white/10">{tr("Mẫu bạn muốn: ", "Look you want: ")}<b className="text-pink-200">{look}</b>{tr(" — gửi ảnh mẫu khi nhắn tiệm để báo giá chính xác.", " — send the photo when you message for an exact quote.")}</p>}
        </header>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {(["US", "AU"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMarket(m); setState(""); }} className={chip(market === m)}><Flag code={m} className="mr-1.5 inline-block h-3.5 w-5 align-[-2px]" />{m === "US" ? tr("Mỹ", "US") : tr("Úc", "AU")}</button>
          ))}
          <button type="button" onClick={() => setState("")} className={chip(!state)}><MapPin className="mr-1 inline h-3.5 w-3.5" />{tr("Tất cả", "All")}</button>
          {(state && !states.includes(state) ? [state, ...states] : states).map((s) => (
            <button key={s} type="button" onClick={() => setState(s)} className={chip(state === s)}>{stateName(market, s)}</button>
          ))}
        </div>
        <SalonDirectory market={market} state={state} />
      </main>
    </div>
  );
}
