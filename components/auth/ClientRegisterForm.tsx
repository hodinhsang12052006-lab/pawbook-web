"use client";

// Đăng ký KHÁCH đi làm nail — 1 màn, ~30 giây: tên, khu vực, email + mật khẩu (SĐT không bắt buộc).
// Không hỏi kỹ năng / lương / tiệm — khách vào thẳng trang chủ riêng (mẫu, tiệm quanh bạn, đặt lịch).
import { apiError } from "@/lib/i18n/apiError";
import React, { useState } from "react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { stateName, US_ALL_CODES, AU_ALL_CODES } from "@/lib/stateNames";
import { guessState } from "@/lib/cityState";
import SocialLogin from "@/components/auth/SocialLogin";
import { AuthTitle, BackToRoles, MarketSeg, PhonePrefix, Submit } from "@/components/auth/fields";
import { tr, currentLocale } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { useViewerMarket } from "@/lib/useViewerMarket";

export default function ClientRegisterForm({ onBack }: { onBack?: () => void }) {
  useTr();
  const [name, setName] = useState("");
  // Thị trường mặc định theo người xem (múi giờ / ngôn ngữ / IP) — khách ở Sydney không bị chọn sẵn Mỹ và
  // đầu số +1. Bấm chọn thì giữ lựa chọn đó.
  const { market: viewerMarket, setMarket: rememberMarket } = useViewerMarket();
  const [picked, setPicked] = useState<"US" | "AU" | null>(null);
  const market = picked ?? viewerMarket;
  const setMarket = (m: "US" | "AU") => { setPicked(m); rememberMarket(m); };
  const [stateRaw, setState] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const states = market === "US" ? US_ALL_CODES : AU_ALL_CODES;
  // Bang của thị trường khác (thị trường mặc định vừa đổi theo IP / múi giờ) → coi như chưa chọn.
  const state = (states as readonly string[]).includes(stateRaw) ? stateRaw : "";
  // Đăng ký bằng Google / Facebook từ màn này → bước Hoàn tất chọn sẵn "Khách".
  React.useEffect(() => { try { localStorage.setItem("pn_role_hint", "CLIENT"); } catch {} }, []);

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
        body: JSON.stringify({ role: "CLIENT", locale: currentLocale(), market, state, city, name: name.trim(), email: email.trim(), password, phone: phone.trim() ? `${market === "US" ? "+1" : "+61"} ${phone.trim()}` : "" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(d, "Không đăng ký được, thử lại.", "Couldn't sign up, try again."));
      const r = await signIn("credentials", { redirect: false, email: email.trim(), password });
      if (!r?.ok) throw new Error(tr("Đã tạo tài khoản — hãy đăng nhập.", "Account created — please log in."));
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Không đăng ký được, thử lại.", "Couldn't sign up, try again."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="pn-stack-24">
      <div>
        <BackToRoles onBack={onBack} />
        <AuthTitle
          title={tr("Tài khoản khách làm nail", "Nail client account")}
          sub={tr("Lưu mẫu yêu thích, tìm tiệm gần bạn và gửi yêu cầu đặt lịch không cần gọi điện.", "Save designs, find salons near you and request bookings without calling.")}
        />
      </div>
      <SocialLogin divider heading={tr("Nhanh nhất: dùng tài khoản có sẵn", "Fastest: use an existing account")} />

      <div className="pn-stack-16">
        <div>
          <label htmlFor="cl-name" className="pn-label">{tr("Tên của bạn", "Your name")}</label>
          <input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={tr("VD: Ngọc Anh", "e.g. Anna")} className="pn-input" />
        </div>
        <MarketSeg value={market} onChange={(m) => { setMarket(m); setState(""); }} label={tr("Bạn ở đâu?", "Where are you?")} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cl-city" className="pn-label">{tr("Thành phố", "City")}</label>
            <input id="cl-city" value={city} autoComplete="address-level2" onChange={(e) => { setCity(e.target.value); const g = guessState(market, e.target.value); if (g && states.includes(g)) setState(g); }} placeholder={market === "AU" ? tr("VD: Parramatta", "e.g. Parramatta") : tr("VD: Houston", "e.g. Houston")} className="pn-input" />
          </div>
          <div>
            <label htmlFor="cl-state" className="pn-label">{tr("Bang", "State")}</label>
            <select id="cl-state" value={state} onChange={(e) => setState(e.target.value)} className="pn-input">
              <option value="">{tr("— Chọn —", "— Select —")}</option>
              {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="pn-stack-16">
        <div>
          <label htmlFor="cl-email" className="pn-label">Email</label>
          <input id="cl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder={tr("ban@email.com", "you@email.com")} className="pn-input" />
        </div>
        <div>
          <label htmlFor="cl-pass" className="pn-label">{tr("Mật khẩu", "Password")}</label>
          <input id="cl-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={tr("Tối thiểu 8 ký tự", "At least 8 characters")} className="pn-input" />
        </div>
        <div>
          <label htmlFor="cl-phone" className="pn-label">{tr("Số điện thoại", "Phone")} <span className="pn-opt">{tr("(không bắt buộc — để tiệm xác nhận lịch)", "(optional — for booking confirmations)")}</span></label>
          <div className="flex items-center gap-2">
            <PhonePrefix market={market} />
            <input id="cl-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={market === "AU" ? "412 345 678" : "555 123 4567"} className="pn-input" aria-describedby="cl-phone-cc" />
            <span id="cl-phone-cc" className="sr-only">{market === "US" ? tr("Mã vùng +1 (Mỹ)", "Country code +1 (US)") : tr("Mã vùng +61 (Úc)", "Country code +61 (Australia)")}</span>
          </div>
        </div>
      </div>
      <Submit busy={busy}>{tr("Tạo tài khoản", "Create account")}</Submit>
    </form>
  );
}
