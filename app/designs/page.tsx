"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, Bookmark } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { DesignCard, DesignSheet, occasionLabel, type Design } from "@/components/designs/DesignViews";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

const SKILLS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước"];

// /designs — "Mẫu nail AI": mẫu mới mỗi ngày theo dịp lễ & xu hướng, kèm vật
// tư cần chuẩn bị và các bước làm. Chỉ hiện mẫu admin ĐÃ DUYỆT.
export default function DesignsPage() {
  useTr(); // render lại khi đổi VI/EN
  const [all, setAll] = useState<Design[] | null>(null);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [open, setOpen] = useState<Design | null>(null);

  useEffect(() => {
    fetch("/api/designs?limit=60")
      .then((r) => (r.ok ? r.json() : { designs: [] }))
      .then((d) => setAll(d.designs || []))
      .catch(() => setAll([]));
  }, []);

  const occasions = useMemo(() => [...new Set((all ?? []).map((d) => d.occasion).filter(Boolean))] as string[], [all]);
  const list = (all ?? []).filter((d) => (!occasion || d.occasion === occasion) && (!skill || d.skills.includes(skill)) && (!savedOnly || d.saved));
  const chip = (on: boolean) => `flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-colors ${on ? "bg-pink-500/20 text-pink-100 ring-pink-400/60" : "text-slate-400 ring-white/10 hover:text-slate-200"}`;
  const update = (id: string, saved: boolean, saves: number) => {
    setAll((l) => l?.map((x) => (x.id === id ? { ...x, saved, saves } : x)) ?? null);
    setOpen((o) => (o && o.id === id ? { ...o, saved, saves } : o));
  };

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 pb-28 pt-6 md:pb-12">
        <header className="space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-pink-300"><Sparkles className="h-4 w-4" />{tr(" PawNail Studio · cập nhật mỗi ngày", " PawNail Studio · updated daily")}</p>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{tr("Mẫu nail mới", "Fresh nail designs")}</h1>
          <p className="max-w-2xl text-sm text-slate-400">{tr("Ý tưởng theo dịp lễ và xu hướng đang lên, kèm vật tư cần chuẩn bị và các bước làm. Ảnh là minh hoạ do AI vẽ — đăng ảnh thật khi bạn làm xong nhé.", "Ideas for upcoming holidays and rising trends, with the materials to prepare and the steps. Images are AI illustrations — post a real photo when you've made it.")}</p>
        </header>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label={tr("Lọc mẫu", "Filter designs")}>
          <button type="button" aria-pressed={!occasion && !skill && !savedOnly} onClick={() => { setOccasion(null); setSkill(null); setSavedOnly(false); }} className={chip(!occasion && !skill && !savedOnly)}>{tr("Tất cả", "All")}</button>
          <button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly((v) => !v)} className={chip(savedOnly)}><Bookmark className="mr-1 inline h-3 w-3" />{tr("Đã lưu", "Saved")}</button>
          {occasions.map((o) => <button key={o} type="button" aria-pressed={occasion === o} onClick={() => setOccasion(occasion === o ? null : o)} className={chip(occasion === o)}>{occasionLabel(o)}</button>)}
          {SKILLS.map((s) => <button key={s} type="button" aria-pressed={skill === s} onClick={() => setSkill(skill === s ? null : s)} className={chip(skill === s)}>{valueLabel(s)}</button>)}
        </div>

        {all === null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center">
            <p className="text-3xl">💅</p>
            <p className="mt-2 text-sm font-bold text-slate-300">{all.length ? tr("Không có mẫu khớp bộ lọc", "No designs match these filters") : tr("Mẫu mới đang được chuẩn bị", "New designs are on the way")}</p>
            <p className="mt-1 text-xs text-slate-500">{tr("Mỗi sáng PawNail ra thêm mẫu mới — quay lại sau nhé.", "PawNail adds new designs every morning — check back soon.")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((d) => <DesignCard key={d.id} d={d} onOpen={() => setOpen(d)} />)}
          </div>
        )}
      </main>
      {open && <DesignSheet d={open} onClose={() => setOpen(null)} onSaved={(s, n) => update(open.id, s, n)} />}
    </div>
  );
}
