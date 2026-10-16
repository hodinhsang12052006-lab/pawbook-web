"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { useSessionUser } from "@/lib/SessionUserContext";

// Thẻ 1 dòng trên Bảng tin: thợ / chủ tiệm CHƯA có menu → "Tạo menu có giá trong 2 phút" (có ảnh sẵn thì
// mở thẳng "Tạo nhanh từ ảnh"). Ẩn khi đang có thẻ "Bắt đầu" (tránh chồng thẻ); bấm ✕ → ẩn 7 ngày.
// Chống giật bố cục (CLS): nhớ "lần trước thẻ có hiện" (pn_mn) → script đầu trang đặt <html data-mn>,
// giữ sẵn đúng chiều cao thẻ trong lúc tải (như thẻ "Bắt đầu").
const HIDE_KEY = "pn_menu_nudge_hide";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const H = "h-[58px]";

function remember(shown: boolean) {
  try {
    if (shown) localStorage.setItem("pn_mn", "1");
    else localStorage.removeItem("pn_mn");
    document.documentElement.toggleAttribute("data-mn", shown);
  } catch {}
}

export default function MenuNudge() {
  useTr();
  const { user, loading } = useSessionUser();
  const [photos, setPhotos] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const eligible = user?.role === "TECHNICIAN" || user?.role === "OWNER";

  useEffect(() => {
    if (loading) return;
    if (!eligible) { remember(false); setChecked(true); return; }
    try {
      if (Date.now() < Number(localStorage.getItem(HIDE_KEY) || 0)) { remember(false); setChecked(true); return; }
    } catch {}
    fetch("/api/menu/photos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const show = !!d && d.menuCount === 0;
        remember(show);
        if (show) setPhotos(d.photos?.length ?? 0);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [eligible, loading]);

  // Đang tải: giữ chỗ chỉ khi lần trước thẻ có hiện (html[data-mn])
  if (!checked) return <div aria-hidden className={`hidden ${H} rounded-2xl bg-white/[0.03] ring-1 ring-white/5 [html[data-mn]_&]:block [[data-nudge]~&]:!hidden`} />;
  if (!eligible || photos === null || !user) return null;
  const hide = () => {
    setPhotos(null);
    remember(false);
    try { localStorage.setItem(HIDE_KEY, String(Date.now() + WEEK)); } catch {}
  };
  return (
    <div className="relative [[data-nudge]~&]:hidden">
      <Link href={`/profile/${user.id}?tab=menu${photos > 0 ? "&quick=1" : ""}`} className={`flex ${H} items-center gap-3 rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/[0.10] to-pink-500/[0.06] pl-3.5 pr-11 transition-colors hover:from-amber-500/[0.16]`}>
        <BookOpen className="h-5 w-5 flex-shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-white">{tr("Tạo menu mẫu có giá — khách xem là nhắn đặt", "Build a priced design menu — clients book from it")}</span>
          <span className="block truncate text-xs text-slate-400">{photos > 0 ? tr(`Dùng ${photos} ảnh bạn đã có, xong trong 2 phút`, `Use your ${photos} existing photos — done in 2 minutes`) : tr("Kèm mã QR in dán ở quầy", "Comes with a QR code for your station")}</span>
        </span>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
      </Link>
      <button type="button" onClick={hide} aria-label={tr("Ẩn gợi ý tạo menu", "Hide menu tip")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:bg-white/10 hover:text-slate-200"><X className="h-4 w-4" /></button>
    </div>
  );
}
