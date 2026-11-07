"use client";

import { apiError } from "@/lib/i18n/apiError";
import React, { useEffect, useState } from "react";
import { Store, Loader2, Hand, Paintbrush } from "lucide-react";
import { AuthTitle, MarketSeg, PhonePrefix, Submit } from "@/components/auth/fields";
import toast from "react-hot-toast";
import { stateName, US_ALL_CODES, AU_ALL_CODES } from "@/lib/stateNames";
import { guessState } from "@/lib/cityState";
import { tr, currentLocale } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { localeHref } from "@/lib/i18n/localeHref";

// Người đăng nhập Google/Apple lần đầu: chọn vai trò + khu vực + SĐT (1 màn,
// ~20 giây) rồi vào app. Đã hoàn tất rồi mà vào lại đây → về trang chủ.
// Đủ 50 bang (trước chỉ 10 → thợ ở MN, MT… kẹt ở bước này).
const US_STATES = US_ALL_CODES;
const AU_STATES = AU_ALL_CODES;

export default function CompleteProfilePage() {
  useTr(); // render lại khi đổi VI/EN
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"TECHNICIAN" | "OWNER" | "CLIENT" | null>(null);
  const [name, setName] = useState("");
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const states = market === "US" ? US_STATES : AU_STATES;
  useEffect(() => { try { if (localStorage.getItem("pn_role_hint") === "CLIENT") setRole("CLIENT"); } catch {} }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (!s?.user?.id) return window.location.replace(localeHref("/auth/login"));
        if (!s.user.needsOnboarding) return window.location.replace(localeHref("/"));
        // Đăng ký bằng SĐT: chưa có tên thật (tên tạm "PawNail member"; tài khoản cũ: "Thành viên PawNail") → để trống cho tự nhập.
        setName(s.user.name && s.user.name !== "PawNail member" && s.user.name !== "Thành viên PawNail" ? s.user.name : "");
        // Đã xác minh SĐT (đăng nhập bằng mã SMS) → điền sẵn số + quốc gia.
        fetch("/api/phone/verify")
          .then((r) => (r.ok ? r.json() : null))
          .then((v) => {
            const e164: string | undefined = v?.verified ? v.phone : undefined;
            if (!e164) return;
            if (e164.startsWith("+61")) { setMarket("AU"); setPhone("0" + e164.slice(3)); }
            else setPhone(e164.slice(2));
          })
          .catch(() => {});
        setReady(true);
      })
      .catch(() => window.location.replace(localeHref("/auth/login")));
  }, []);

  const submit = async () => {
    const isClient = role === "CLIENT";
    if (!role || !state || !name.trim() || (!isClient && (!city.trim() || phone.replace(/\D/g, "").length < 8))) {
      toast.error(isClient ? tr("Nhập tên và chọn khu vực của bạn nhé.", "Enter your name and pick your area.") : tr("Nhập tên, chọn vai trò, bang, thành phố và số điện thoại nhé.", "Enter your name, pick a role, state, city and phone number."));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, locale: currentLocale(), market, state, city, name, phone: phone.trim() ? `${market === "US" ? "+1" : "+61"} ${phone.trim()}` : "" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(d, "Không lưu được, thử lại.", "Couldn't save, try again."));
      await fetch("/api/auth/session"); // làm mới phiên với vai trò vừa chọn
      try { localStorage.removeItem("pn_role_hint"); } catch {}
      window.location.href = localeHref(role === "OWNER" ? "/jobs/create" : role === "CLIENT" ? "/" : "/?tab=jobs");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Không lưu được, thử lại.", "Couldn't save, try again."));
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 640 }} aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-[#f59bbe]" aria-hidden />
      </div>
    );
  }

  const roles = [
    { id: "CLIENT" as const, icon: Hand, title: tr("Tôi là khách làm nail", "I'm a nail client"), desc: tr("Thử mẫu trên tay, tìm tiệm và gửi yêu cầu đặt lịch", "Try on looks, discover salons and request a booking") },
    { id: "TECHNICIAN" as const, icon: Paintbrush, title: tr("Tôi là thợ nail", "I'm a nail technician"), desc: tr("Giới thiệu tay nghề, để tiệm tìm đến và xem việc làm", "Showcase your work, get found by salons and browse jobs") },
    { id: "OWNER" as const, icon: Store, title: tr("Tôi là chủ tiệm hoặc quản lý", "I own or manage a salon"), desc: tr("Tuyển thợ, chia sẻ menu dịch vụ và nhận yêu cầu đặt lịch", "Hire technicians, share your menu and take booking requests") },
  ];

  return (
    <div className="pn-stack-24">
      <AuthTitle title={tr("Chào mừng bạn đến với PawNail", "Welcome to PawNail")} sub={tr("Còn 1 bước — cho PawNail biết bạn là ai và ở đâu.", "One last step — tell PawNail who you are and where you work.")} />

      <div className="pn-list" role="radiogroup" aria-label={tr("Bạn sử dụng PawNail với vai trò nào?", "How will you use PawNail?")}>
        {roles.map(({ id, icon: Icon, title, desc }) => (
          <button key={id} type="button" role="radio" aria-checked={role === id} onClick={() => setRole(id)} className="pn-row" style={role === id ? { background: "var(--color-pn-brand-tint)" } : undefined}>
            <span className="pn-row-icon" aria-hidden><Icon strokeWidth={1.75} /></span>
            <span className="min-w-0">
              <span className="pn-row-title">{title}</span>
              <span className="pn-row-desc">{desc}</span>
            </span>
            <span aria-hidden className="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ boxShadow: role === id ? "inset 0 0 0 6px #f59bbe" : "inset 0 0 0 1.5px #a69ba4" }} />
          </button>
        ))}
      </div>

      <div className="pn-stack-16">
        <div>
          <label htmlFor="c-name" className="pn-label">{tr("Tên hiển thị", "Display name")}</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("VD: Lan Nguyễn", "e.g. Lan Nguyen")} autoComplete="name" className="pn-input" />
        </div>
        <MarketSeg value={market} onChange={(m) => { setMarket(m); setState(""); }} label={tr("Bạn ở đâu?", "Where are you?")} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="c-city" className="pn-label">{tr("Thành phố", "City")}</label>
            <input
              id="c-city"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                const g = guessState(market, e.target.value);
                if (g && states.includes(g)) setState(g);
              }}
              placeholder={tr("VD: Houston", "e.g. Houston")}
              className="pn-input"
            />
          </div>
          <div>
            <label htmlFor="c-state" className="pn-label">{tr("Bang", "State")}</label>
            <select id="c-state" value={state} onChange={(e) => setState(e.target.value)} className="pn-input">
              <option value="">{tr("— Chọn —", "— Select —")}</option>
              {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="c-phone" className="pn-label">{tr("Số điện thoại", "Phone number")}{role === "CLIENT" && <span className="pn-opt">{tr(" (không bắt buộc)", " (optional)")}</span>}</label>
          <div className="flex items-center gap-2">
            <PhonePrefix market={market} />
            <input id="c-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555 123 4567" className="pn-input" />
          </div>
          <p className="pn-hint">{tr("Không hiện công khai trên hồ sơ của bạn.", "Not shown publicly on your profile.")}</p>
        </div>
      </div>

      <Submit type="button" onClick={submit} busy={busy}>{tr("Vào PawNail", "Enter PawNail")}</Submit>
    </div>
  );
}
