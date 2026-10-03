"use client";

import React, { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Store, ArrowRight, UserPlus, SlidersHorizontal, MessageCircle, ChevronDown } from "lucide-react";
import { TOTAL_DEMAND_COUNT } from "@/lib/nailRadarData";
import { AuthSettingsContext } from "@/lib/AuthSettingsContext";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import TechnicianRegisterForm from "@/components/auth/TechnicianRegisterForm";
import OwnerRegisterForm from "@/components/auth/OwnerRegisterForm";

type Role = "technician" | "owner" | null;

const PRESS = "active:scale-[0.98] transition-transform duration-100";

function RolePicker({ onPick }: { onPick: (role: Role) => void }) {
  const { theme } = useContext(AuthSettingsContext);
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const cardClass = isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200";
  const labelClass = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h2 className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>{t("auth.rolePicker.title")}</h2>
        <p className={`text-sm ${labelClass}`}>{t("auth.rolePicker.subtitle")}</p>
      </div>

      <button
        type="button"
        onClick={() => onPick("technician")}
        className={`w-full min-h-[48px] flex items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all ${PRESS} ${cardClass} hover:border-pink-500/50`}
      >
        <Sparkles className="h-8 w-8 text-pink-500 flex-shrink-0" />
        <div className="flex-1">
          <p className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{t("auth.rolePicker.technicianTitle")}</p>
          <p className={`text-sm ${labelClass}`}>{t("auth.rolePicker.technicianDesc")}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-pink-400">{t("auth.rolePicker.technicianPerks")}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
      </button>

      <button
        type="button"
        onClick={() => onPick("owner")}
        className={`w-full min-h-[48px] flex items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all ${PRESS} ${cardClass} hover:border-pink-500/50`}
      >
        <Store className="h-8 w-8 text-pink-500 flex-shrink-0" />
        <div className="flex-1">
          <p className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{t("auth.rolePicker.ownerTitle")}</p>
          <p className={`text-sm ${labelClass}`}>{t("auth.rolePicker.ownerDesc")}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-pink-400">{t("auth.rolePicker.ownerPerks")}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
      </button>

      <p className={`text-center text-sm ${labelClass}`}>
        {t("auth.rolePicker.haveAccount")}{" "}
        <Link href="/auth/login" className="font-bold text-pink-500 hover:underline">{t("auth.rolePicker.login")}</Link>
      </p>

      {/* Số liệu thật (lấy từ nailRadarData, cùng nguồn với badge bên trái) —
          không bịa số người dùng. */}
      <div className={`grid grid-cols-3 divide-x rounded-2xl border ${isDark ? "divide-slate-800 border-slate-800 bg-slate-900/30" : "divide-slate-200 border-slate-200 bg-white"}`}>
        {[
          { value: `${(TOTAL_DEMAND_COUNT.US + TOTAL_DEMAND_COUNT.AU).toLocaleString("en-US")}+`, label: t("auth.rolePicker.statJobs") },
          { value: "2", label: t("auth.rolePicker.statMarkets") },
          { value: "100%", label: t("auth.rolePicker.statFree") },
        ].map((stat) => (
          <div key={stat.label} className="px-2 py-3 text-center">
            <p className={`text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>{stat.value}</p>
            <p className={`text-[10px] leading-tight ${labelClass}`}>{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h3 className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{t("auth.rolePicker.howTitle")}</h3>
        <ol className="space-y-2.5">
          {[
            { icon: UserPlus, title: t("auth.rolePicker.how1Title"), desc: t("auth.rolePicker.how1Desc") },
            { icon: SlidersHorizontal, title: t("auth.rolePicker.how2Title"), desc: t("auth.rolePicker.how2Desc") },
            { icon: MessageCircle, title: t("auth.rolePicker.how3Title"), desc: t("auth.rolePicker.how3Desc") },
          ].map(({ icon: Icon, title, desc }, i) => (
            <li key={title} className="flex items-start gap-3">
              <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-pink-500/20">
                <Icon className="h-4 w-4 text-pink-400" />
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-pink-600 text-[9px] font-black text-white">{i + 1}</span>
              </span>
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{title}</p>
                <p className={`text-xs ${labelClass}`}>{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{t("auth.rolePicker.faqTitle")}</h3>
        {[1, 2, 3, 4].map((n) => (
          <details key={n} className={`group rounded-xl border px-4 py-3 ${isDark ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-white"}`}>
            <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              {t(`auth.rolePicker.faq${n}Q`)}
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <p className={`mt-2 text-xs leading-relaxed ${labelClass}`}>{t(`auth.rolePicker.faq${n}A`)}</p>
          </details>
        ))}
      </section>
    </div>
  );
}

export default function CustomRegisterPage() {
  const [role, setRole] = useState<Role>(null);
  const [ready, setReady] = useState(false);

  // Đọc ?role= trên URL phía client (tránh useSearchParams + Suspense —
  // từng gây double-render/kẹt loading trên Next 16 dev mode, xem app/page.tsx).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("role");
    if (r === "technician" || r === "owner") setRole(r);
    setReady(true);
  }, []);

  // Chặn đứng: phát hiện qua test thật trên production rằng người dùng ĐÃ
  // đăng nhập thành công (session hợp lệ) vẫn có thể bị điều hướng tới đây
  // (nguyên nhân sâu xa chưa xác định được — chỉ xảy ra trên hạ tầng
  // production/Vercel, không tái hiện được ở local `next start`, và chỉ xảy
  // ra với request dạng RSC soft-navigation chứ không phải document load
  // thường — đã thử: xoá pages.newUser, tắt service worker, context trình
  // duyệt hoàn toàn sạch, đều không hết). Vì fetch thẳng "/" bằng document
  // request LUÔN trả đúng nội dung (đã verify bằng curl + fetch trực tiếp),
  // chốt chặn này bắt đúng triệu chứng: nếu phát hiện có session hợp lệ mà
  // lại đang đứng ở trang đăng ký, buộc HARD RELOAD (không dùng router.push)
  // để né hẳn đường dẫn RSC bị lỗi, đưa thẳng người dùng về trang chủ.
  useEffect(() => {
    // Chặn vòng lặp: nếu "/" TỰ NÓ cũng đang bị đá về đây (nguyên nhân gốc
    // chưa xác định chắc chắn 100%, nghi do cold-start phía Vercel — có lúc
    // tái hiện, có lúc không), redirect thẳng lại "/" mà không kiểm tra gì
    // sẽ tạo vòng lặp vô hạn /→/auth/register→/→/auth/register... còn TỆ
    // HƠN bug gốc (trước chỉ là sai trang, giờ là treo hẳn không dùng được).
    // Chỉ bounce 1 lần trong mỗi 5 giây; nếu quay lại đây quá nhanh, dừng
    // hẳn và hiện trang đăng ký bình thường thay vì lặp mãi.
    const lastBounceAt = Number(sessionStorage.getItem("authBounceAt") || 0);
    if (Date.now() - lastBounceAt < 5000) return;

    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((session) => {
        if (session?.user?.id) {
          sessionStorage.setItem("authBounceAt", String(Date.now()));
          window.location.replace("/");
        }
      })
      .catch(() => {});
  }, []);

  const pickRole = (r: Role) => {
    setRole(r);
    const url = new URL(window.location.href);
    if (r) url.searchParams.set("role", r);
    window.history.replaceState({}, "", url.toString());
  };

  if (!ready) return null;

  if (role === "technician") return <TechnicianRegisterForm />;
  if (role === "owner") return <OwnerRegisterForm />;
  return <RolePicker onPick={pickRole} />;
}
