"use client";

import React, { useContext, useEffect, useState } from "react";
import { Sparkles, Store, ArrowRight } from "lucide-react";
import { AuthSettingsContext } from "@/lib/AuthSettingsContext";
import TechnicianRegisterForm from "@/components/auth/TechnicianRegisterForm";
import OwnerRegisterForm from "@/components/auth/OwnerRegisterForm";

type Role = "technician" | "owner" | null;

function RolePicker({ onPick }: { onPick: (role: Role) => void }) {
  const { theme } = useContext(AuthSettingsContext);
  const isDark = theme === "dark";
  const cardClass = isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200";
  const labelClass = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h2 className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>Bạn là ai?</h2>
        <p className={`text-sm ${labelClass}`}>Chọn để bắt đầu — chỉ mất chưa đến 1 phút</p>
      </div>

      <button
        type="button"
        onClick={() => onPick("technician")}
        className={`w-full flex items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all ${cardClass} hover:border-pink-500/50`}
      >
        <Sparkles className="h-8 w-8 text-pink-500 flex-shrink-0" />
        <div className="flex-1">
          <p className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>💅 Tôi là Thợ Nail</p>
          <p className={`text-sm ${labelClass}`}>Đăng portfolio, tìm việc gấp gần bạn</p>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
      </button>

      <button
        type="button"
        onClick={() => onPick("owner")}
        className={`w-full flex items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all ${cardClass} hover:border-pink-500/50`}
      >
        <Store className="h-8 w-8 text-pink-500 flex-shrink-0" />
        <div className="flex-1">
          <p className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>🏪 Tôi là Chủ Tiệm</p>
          <p className={`text-sm ${labelClass}`}>Đăng tin tuyển thợ, xem portfolio thợ</p>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
      </button>
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
