"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Store, Loader2, Phone, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { stateName } from "@/lib/stateNames";
import { guessState } from "@/lib/cityState";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// Người đăng nhập Google/Apple lần đầu: chọn vai trò + khu vực + SĐT (1 màn,
// ~20 giây) rồi vào app. Đã hoàn tất rồi mà vào lại đây → về trang chủ.
const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];

export default function CompleteProfilePage() {
  useTr(); // render lại khi đổi VI/EN
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"TECHNICIAN" | "OWNER" | null>(null);
  const [name, setName] = useState("");
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const states = market === "US" ? US_STATES : AU_STATES;

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (!s?.user?.id) return window.location.replace("/auth/login");
        if (!s.user.needsOnboarding) return window.location.replace("/");
        setName(s.user.name || "");
        setReady(true);
      })
      .catch(() => window.location.replace("/auth/login"));
  }, []);

  const submit = async () => {
    if (!role || !state || !city.trim() || phone.replace(/\D/g, "").length < 8) {
      toast.error(tr("Chọn vai trò, bang, thành phố và nhập số điện thoại nhé.", "Pick a role, state, city and enter your phone number."));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, market, state, city, name, phone: `${market === "US" ? "+1" : "+61"} ${phone.trim()}` }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || tr("Không lưu được, thử lại.", "Couldn't save, try again."));
      await fetch("/api/auth/session"); // làm mới phiên với vai trò vừa chọn
      window.location.href = role === "OWNER" ? "/jobs/create" : "/?tab=jobs";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Không lưu được, thử lại.", "Couldn't save, try again."));
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
      </div>
    );
  }

  const card = (on: boolean) =>
    `flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${on ? "border-pink-500 bg-pink-500/10" : "border-slate-800 bg-slate-900/40 hover:border-pink-500/40"}`;

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-extrabold text-white">{tr("Chào mừng bạn! 👋", "Welcome! 👋")}</h1>
        <p className="text-sm text-slate-400">{tr("Còn 1 bước — cho PawNail biết bạn là ai và ở đâu.", "One last step — tell PawNail who you are and where you work.")}</p>
      </div>

      <div className="space-y-2.5" role="radiogroup" aria-label={tr("Bạn là ai?", "Who are you?")}>
        <button type="button" role="radio" aria-checked={role === "TECHNICIAN"} onClick={() => setRole("TECHNICIAN")} className={card(role === "TECHNICIAN")}>
          <Sparkles className="h-7 w-7 flex-shrink-0 text-pink-400" />
          <span>
            <span className="block font-bold text-white">{tr("Tôi là Thợ Nail", "I'm a nail tech")}</span>
            <span className="block text-xs text-slate-400">{tr("Tìm việc gấp, đăng portfolio", "Find work, show your portfolio")}</span>
          </span>
        </button>
        <button type="button" role="radio" aria-checked={role === "OWNER"} onClick={() => setRole("OWNER")} className={card(role === "OWNER")}>
          <Store className="h-7 w-7 flex-shrink-0 text-pink-400" />
          <span>
            <span className="block font-bold text-white">{tr("Tôi là Chủ Tiệm", "I own a salon")}</span>
            <span className="block text-xs text-slate-400">{tr("Đăng tin tuyển thợ, xem portfolio thợ", "Post jobs, browse tech portfolios")}</span>
          </span>
        </button>
      </div>

      <div>
        <label htmlFor="c-name" className="mb-1.5 block text-sm font-bold text-slate-300">{tr("Tên hiển thị", "Display name")}</label>
        <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["US", "AU"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={market === m} onClick={() => { setMarket(m); setState(""); }} className={`min-h-[44px] rounded-2xl border-2 text-sm font-bold ${market === m ? "border-pink-500 bg-pink-500/10 text-white" : "border-slate-800 text-slate-400"}`}>
            {m === "US" ? tr("🇺🇸 Mỹ", "🇺🇸 United States") : tr("🇦🇺 Úc", "🇦🇺 Australia")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="c-city" className="mb-1.5 flex items-center gap-1 text-sm font-bold text-slate-300"><MapPin className="h-3.5 w-3.5" />{tr(" Thành phố", " City")}</label>
          <input
            id="c-city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              const g = guessState(market, e.target.value);
              if (g && states.includes(g)) setState(g);
            }}
            placeholder={tr("VD: Houston", "e.g. Houston")}
            className="input-field"
          />
        </div>
        <div>
          <label htmlFor="c-state" className="mb-1.5 block text-sm font-bold text-slate-300">{tr("Bang", "State")}</label>
          <select id="c-state" value={state} onChange={(e) => setState(e.target.value)} className="input-field">
            <option value="">{tr("— Chọn —", "— Select —")}</option>
            {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="c-phone" className="mb-1.5 flex items-center gap-1 text-sm font-bold text-slate-300"><Phone className="h-3.5 w-3.5" />{tr(" Số điện thoại", " Phone number")}</label>
        <div className="flex gap-2">
          <span className="flex min-h-[48px] items-center rounded-2xl border border-slate-800 bg-slate-950 px-3 text-sm font-bold text-slate-300">{market === "US" ? "+1" : "+61"}</span>
          <input id="c-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555 123 4567" className="input-field flex-1" />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{tr("Không hiện công khai trên hồ sơ của bạn.", "Not shown publicly on your profile.")}</p>
      </div>

      <button type="button" onClick={submit} disabled={busy} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-base font-black text-white shadow-lg shadow-pink-600/25 disabled:opacity-60">
        {busy && <Loader2 className="h-5 w-5 animate-spin" />} {tr("Vào PawNail", "Enter PawNail")}
      </button>
    </div>
  );
}
