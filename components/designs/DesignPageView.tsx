"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, UserPlus } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { AiBadge, DesignDetail, DesignVisual, designTitle, type Design } from "@/components/designs/DesignViews";
import { useSessionUser } from "@/lib/SessionUserContext";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

/** Trang riêng 1 mẫu nail: ảnh lớn + chi tiết (dùng chung DesignDetail) + mẫu cùng xu hướng. */
export default function DesignPageView({ d: d0, related }: { d: Design; related: Design[] }) {
  useTr(); // render lại khi đổi VI/EN
  const { user } = useSessionUser();
  const [d, setD] = useState(d0);
  // trạng thái "đã lưu" của người đang xem (trang dựng sẵn phía máy chủ không biết ai đang xem)
  useEffect(() => {
    if (!user) return;
    fetch(`/api/designs/${d0.id}/save`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => { if (r) setD((x) => ({ ...x, saved: r.saved, saves: r.saves })); })
      .catch(() => {});
  }, [user, d0.id]);

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 pb-28 pt-5 md:pb-12">
        <Link href="/designs" className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> {tr("Tất cả mẫu nail", "All nail designs")}
        </Link>

        <article className="grid gap-6 md:grid-cols-2 md:items-start">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-slate-900 md:sticky md:top-20">
            <DesignVisual d={d} width={1024} />
            <AiBadge d={d} className="absolute left-3 top-3" />
          </div>
          <DesignDetail d={d} standalone onSaved={(saved, saves) => setD((x) => ({ ...x, saved, saves }))} />
        </article>

        {!user && (
          <section className="flex flex-col items-start gap-3 rounded-3xl bg-gradient-to-br from-pink-600/20 to-fuchsia-600/10 p-5 ring-1 ring-pink-400/25 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-black text-white">{tr("Thợ nail? Lưu mẫu, thêm vào menu giá của bạn", "Nail tech? Save designs and add them to your price menu")}</p>
              <p className="text-sm text-slate-300">{tr("Mỗi ngày có mẫu mới theo xu hướng, kèm vật tư và các bước. Khách xem menu của bạn rồi đặt lịch.", "New trend designs every day with materials and steps. Clients browse your menu and book.")}</p>
            </div>
            <Link href="/auth/register" className="inline-flex min-h-[48px] flex-shrink-0 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-900">
              <UserPlus className="h-4 w-4" /> {tr("Đăng ký miễn phí", "Sign up free")}
            </Link>
          </section>
        )}

        {related.length > 0 && (
          <section aria-label={tr("Mẫu cùng xu hướng", "Related designs")} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-white"><Sparkles className="h-5 w-5 text-pink-300" />{tr(" Mẫu cùng xu hướng", " More like this")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {related.map((r) => (
                <Link key={r.id} href={`/designs/${r.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 hover:border-pink-400/40">
                  <span className="relative block aspect-square overflow-hidden bg-slate-800">
                    <DesignVisual d={r} className="transition-transform duration-300 group-hover:scale-105" />
                  </span>
                  <span className="block p-3 text-sm font-bold leading-snug text-white">{designTitle(r)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
