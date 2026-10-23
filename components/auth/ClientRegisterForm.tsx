"use client";

// Đăng ký KHÁCH đi làm nail — 1 màn, ~30 giây: tên, khu vực, email + mật khẩu (SĐT không bắt buộc).
// Không hỏi kỹ năng / lương / tiệm — khách vào thẳng trang chủ riêng (mẫu, tiệm quanh bạn, đặt lịch).
import React, { useContext, useState } from "react";
import { signIn } from "next-auth/react";
import { Heart, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { AuthSettingsContext } from "@/lib/AuthSettingsContext";
import { stateName, US_ALL_CODES, AU_ALL_CODES } from "@/lib/stateNames";
import { guessState } from "@/lib/cityState";
import SocialLogin from "@/components/auth/SocialLogin";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function ClientRegisterForm() {
  useTr();
  const { theme } = useContext(AuthSettingsContext);
  const isDark = theme === "dark";
  const [name, setName] = useState("");
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const states = market === "US" ? US_ALL_CODES : AU_ALL_CODES;
  // Đăng ký bằng Google / Facebook từ màn này → bước Hoàn tất chọn sẵn "Khách".
  React.useEffect(() => { try { localStorage.setItem("pn_role_hint", "CLIENT"); } catch {} }, []);
  const field = `w-full min-h-[48px] rounded-2xl border px-4 py-3 text-base ${isDark ? "border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"}`;
  const label = `mb-1.5 block text-sm font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !state || !email.trim() || password.length < 8) {
      toast.error(tr("Nhập tên, khu vực, email và mật khẩu (từ 8 ký tự) nhé.", "Enter your name, area, email and a password (8+ characters)."));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "CLIENT", market, state, city, name: name.trim(), email: email.trim(), password, phone: phone.trim() ? `${market === "US" ? "+1" : "+61"} ${phone.trim()}` : "" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || tr("Không đăng ký được, thử lại.", "Couldn't sign up, try again."));
      const r = await signIn("credentials", { redirect: false, email: email.trim(), password });
      if (!r?.ok) throw new Error(tr("Đã tạo tài khoản — hãy đăng nhập.", "Account created — please log in."));
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Không đăng ký được, thử lại.", "Couldn't sign up, try again."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-4">
      <div className="space-y-1 text-center lg:text-left">
        <h2 className={`flex items-center justify-center gap-2 text-2xl font-extrabold lg:justify-start ${isDark ? "text-white" : "text-slate-900"}`}><Heart className="h-6 w-6 text-pink-500" />{tr("Tài khoản khách làm nail", "Nail client account")}</h2>
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{tr("Lưu mẫu yêu thích, tìm tiệm gần bạn, đặt lịch không cần gọi — miễn phí.", "Save looks, find salons near you, book without calling — free.")}</p>
      </div>
      <SocialLogin dark={isDark} divider heading={tr("Nhanh nhất: dùng tài khoản có sẵn", "Fastest: use an existing account")} />
      <div>
        <label htmlFor="cl-name" className={label}>{tr("Tên của bạn", "Your name")}</label>
        <input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={tr("VD: Ngọc Anh", "e.g. Anna")} className={field} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["US", "AU"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={market === m} onClick={() => { setMarket(m); setState(""); }} className={`min-h-[44px] rounded-2xl border-2 text-sm font-bold ${market === m ? "border-pink-500 bg-pink-500/10" : isDark ? "border-slate-800" : "border-slate-200"} ${isDark ? "text-white" : "text-slate-900"}`}>
            {m === "US" ? tr("🇺🇸 Mỹ", "🇺🇸 US") : tr("🇦🇺 Úc", "🇦🇺 Australia")}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cl-city" className={label}>{tr("Thành phố", "City")}</label>
          <input id="cl-city" value={city} onChange={(e) => { setCity(e.target.value); const g = guessState(market, e.target.value); if (g && states.includes(g)) setState(g); }} placeholder={tr("VD: Houston", "e.g. Houston")} className={field} />
        </div>
        <div>
          <label htmlFor="cl-state" className={label}>{tr("Bang", "State")}</label>
          <select id="cl-state" value={state} onChange={(e) => setState(e.target.value)} className={field}>
            <option value="">{tr("— Chọn —", "— Select —")}</option>
            {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="cl-email" className={label}>Email</label>
        <input id="cl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="ban@email.com" className={field} />
      </div>
      <div>
        <label htmlFor="cl-pass" className={label}>{tr("Mật khẩu", "Password")}</label>
        <input id="cl-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={tr("Tối thiểu 8 ký tự", "At least 8 characters")} className={field} />
      </div>
      <div>
        <label htmlFor="cl-phone" className={label}>{tr("Số điện thoại", "Phone")} <span className="font-normal text-slate-500">{tr("(không bắt buộc — để tiệm xác nhận lịch)", "(optional — for booking confirmations)")}</span></label>
        <input id="cl-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555 123 4567" className={field} />
      </div>
      <button type="submit" disabled={busy} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-base font-black text-white shadow-lg shadow-pink-600/25 disabled:opacity-60">
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}{tr("Tạo tài khoản", "Create account")}
      </button>
    </form>
  );
}
