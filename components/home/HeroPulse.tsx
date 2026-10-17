"use client";

// Bằng chứng NGAY màn hình đầu cho khách mới: "56 việc đang tuyển · 26 việc gấp · 56 tin mới 7 ngày".
// Tâm lý: người lạ chỉ tin một sàn việc khi thấy nó ĐANG CÓ NGƯỜI DÙNG — con số thật (cùng nguồn với bảng
// việc, CDN giữ 20s) thay cho câu "#1" suông. Giữ sẵn chiều cao → không xô lệch bố cục lúc tải (CLS).
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function HeroPulse() {
  useTr();
  const [n, setN] = useState<{ total: number; urgent: number; fresh: number } | null>(null);
  useEffect(() => {
    let off = false;
    fetch("/api/jobs?page=1&pageSize=5")
      .then((r) => (r.ok ? { total: Number(r.headers.get("X-Total-Count")) || 0, urgent: Number(r.headers.get("X-Urgent-Count")) || 0, fresh: Number(r.headers.get("X-New-7d")) || 0 } : null))
      .then((v) => { if (!off && v && v.total > 0) setN(v); })
      .catch(() => {});
    return () => { off = true; };
  }, []);
  return (
    <div className="flex min-h-[44px] items-center justify-center">
      {n && (
        <Link href="/?tab=jobs" className="pn-fade-in inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/10 backdrop-blur hover:ring-pink-400/40 sm:text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span><b className="text-white tabular-nums">{n.total}</b> {tr("việc đang tuyển", "open jobs")}</span>
          {n.urgent > 0 && <span className="text-orange-300">🔥 <b className="tabular-nums">{n.urgent}</b> {tr("việc gấp", "urgent")}</span>}
          {n.fresh > 0 && <span className="text-slate-400"><b className="text-slate-200 tabular-nums">{n.fresh}</b> {tr("tin mới 7 ngày", "new this week")}</span>}
        </Link>
      )}
    </div>
  );
}
