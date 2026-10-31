"use client";

// Số liệu trực tiếp, trình bày điềm tĩnh: "56 việc làm đang tuyển · 12 tin mới tuần này" — cùng nguồn với
// bảng việc làm (CDN giữ 20s). Dưới 10 tin thì ẩn hẳn (số quá nhỏ trông vắng, không giúp ai).
// Không đếm "việc gấp" ở đây. Giữ sẵn chiều cao → không xô lệch bố cục lúc tải (CLS).
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function HeroPulse() {
  useTr();
  const [n, setN] = useState<{ total: number; fresh: number } | null>(null);
  useEffect(() => {
    let off = false;
    fetch("/api/jobs?page=1&pageSize=5")
      .then((r) => (r.ok ? { total: Number(r.headers.get("X-Total-Count")) || 0, fresh: Number(r.headers.get("X-New-7d")) || 0 } : null))
      .then((v) => { if (!off && v && v.total >= 10) setN(v); })
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
          <span><b className="text-white tabular-nums">{n.total.toLocaleString("en-US")}</b> {tr("việc làm đang tuyển", "open nail jobs")}</span>
          {n.fresh > 0 && <span className="text-slate-400"><span aria-hidden className="mr-3 text-slate-600">·</span><b className="text-slate-200 tabular-nums">{n.fresh.toLocaleString("en-US")}</b> {tr("tin mới tuần này", "posted this week")}</span>}
        </Link>
      )}
    </div>
  );
}
