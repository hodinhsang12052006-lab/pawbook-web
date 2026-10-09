"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Clock, Sparkles, X, ShoppingBag, Camera, ListChecks, ChevronRight, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useSessionUser } from "@/lib/SessionUserContext";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { dt } from "@/lib/i18n/dataEn";
import { THEMES } from "@/lib/studioThemes";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { playSound } from "@/lib/sounds";
import NailArt from "@/components/designs/NailArt";

export interface Design {
  id: string;
  day: string;
  occasion: string | null;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  skills: string[];
  difficulty: number;
  minutes: number;
  priceHint: string;
  materials: { vi: string; en: string; qty: string }[];
  steps: { vi: string; en: string }[];
  imageUrl: string | null;
  videoUrl: string | null;
  palette?: string[];
  shape?: string;
  finish?: string;
  provider?: string;
  saves: number;
  saved?: boolean;
  publishedAt: string | null;
}

export const designTitle = (d: Design) => tr(d.title, d.titleEn || d.title);
export const occasionLabel = (id: string | null) => {
  const t = id ? THEMES.find((x) => x.id === id) : null;
  return t ? `${t.emoji} ${dt(t.title)}` : null;
};
const DIFF = () => [tr("Dễ", "Easy"), tr("Vừa", "Medium"), tr("Khó", "Advanced")];
export const hashtagFor = (d: Design) => {
  const t = d.occasion ? THEMES.find((x) => x.id === d.occasion) : null;
  return t ? `#${t.hashtag}` : "#PawNailAI";
};

/** Nhãn bắt buộc, nói đúng nguồn — không để ai hiểu nhầm là ảnh tay nghề thật:
 *  ảnh do AI vẽ · ý tưởng AI + minh hoạ màu do app vẽ · mẫu gợi ý + minh hoạ màu. */
export function AiBadge({ d, className = "" }: { d?: Pick<Design, "imageUrl" | "provider">; className?: string }) {
  useTr(); // render lại khi đổi VI/EN
  const label = !d || d.imageUrl
    ? tr(" Ảnh minh hoạ AI", " AI illustration")
    : d.provider === "sample"
      ? tr(" Minh hoạ màu", " Color preview")
      : tr(" Ý tưởng AI · minh hoạ màu", " AI idea · color preview");
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur ${className}`}>
      <Wand2 className="h-3 w-3" />{label}
    </span>
  );
}

/** Ảnh AI nếu có, không thì minh hoạ tự vẽ từ bảng màu/dáng/hiệu ứng. */
export function DesignVisual({ d, className = "" }: { d: Design; className?: string }) {
  if (d.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={d.imageUrl} alt={designTitle(d)} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return <NailArt palette={d.palette ?? []} shape={d.shape} finish={d.finish} seed={d.id} className={`h-full w-full ${className}`} />;
}

export function DesignCard({ d, onOpen, compact = false }: { d: Design; onOpen: () => void; compact?: boolean }) {
  useTr(); // render lại khi đổi VI/EN
  const occ = occasionLabel(d.occasion);
  return (
    <button type="button" onClick={onOpen} className={`group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 text-left transition-all hover:border-pink-400/40 ${compact ? "w-44 flex-shrink-0" : ""}`}>
      <span className="relative block aspect-square w-full overflow-hidden bg-slate-800">
        <DesignVisual d={d} className="transition-transform duration-300 group-hover:scale-105" />
        <AiBadge d={d} className="absolute left-2 top-2" />
        {d.saves > 0 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white">
            <Bookmark className="h-3 w-3" /> {d.saves}
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3">
        {occ && <span className="truncate text-[10px] font-black uppercase tracking-wider text-pink-300">{occ}</span>}
        <span className="line-clamp-2 text-sm font-bold leading-snug text-white">{designTitle(d)}</span>
        <span className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-slate-400">
          <span>{DIFF()[d.difficulty - 1]}</span>·<span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" /> {d.minutes}{tr(" phút", " min")}</span>
          {!compact && d.priceHint && <>·<span className="font-semibold text-emerald-300">{d.priceHint}</span></>}
        </span>
      </span>
    </button>
  );
}

export function DesignSheet({ d, onClose, onSaved }: { d: Design; onClose: () => void; onSaved: (saved: boolean, saves: number) => void }) {
  useTr(); // render lại khi đổi VI/EN
  const { user } = useSessionUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const occ = occasionLabel(d.occasion);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!user) return router.push("/auth/login");
    setBusy(true);
    try {
      const res = await fetch(`/api/designs/${d.id}/save`, { method: "POST" });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      onSaved(r.saved, r.saves);
      if (r.saved) {
        playSound("like");
        toast.success(tr("Đã lưu mẫu — xem lại trong mục “Đã lưu”.", "Design saved — find it under “Saved”."));
      }
    } catch {
      toast.error(tr("Không lưu được, thử lại.", "Couldn't save, try again."));
    } finally {
      setBusy(false);
    }
  };

  const tryIt = () => {
    // Mở ô soạn bài với hashtag của mẫu — người làm thật đăng ảnh thật.
    try {
      sessionStorage.setItem("pn_compose_tag", hashtagFor(d).slice(1)); // composer tự thêm "#"
    } catch {}
    router.push("/?tab=feed");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label={designTitle(d)} className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-square w-full bg-slate-900">
          <DesignVisual d={d} />
          <AiBadge d={d} className="absolute left-3 top-3" />
          <button type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="space-y-1.5">
            {occ && <p className="text-[11px] font-black uppercase tracking-wider text-pink-300">{occ}</p>}
            <h2 className="text-xl font-black leading-tight text-white">{designTitle(d)}</h2>
            <p className="text-sm leading-relaxed text-slate-300">{tr(d.description, d.descriptionEn || d.description)}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-200">{DIFF()[d.difficulty - 1]}</span>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-200">⏱ {d.minutes}{tr(" phút", " min")}</span>
              {d.priceHint && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">{tr("Giá gợi ý ", "Suggested price ")}{d.priceHint}</span>}
              {d.skills.map((s) => <span key={s} className="rounded-full bg-pink-500/10 px-2.5 py-1 text-[11px] font-semibold text-pink-300">{valueLabel(s)}</span>)}
            </div>
          </div>

          <section aria-label={tr("Vật tư cần chuẩn bị", "Materials to prepare")} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-black text-white"><ShoppingBag className="h-4 w-4 text-emerald-300" />{tr(" Vật tư cần chuẩn bị", " Materials to prepare")}</h3>
            <ul className="space-y-1.5">
              {d.materials.map((m, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
                  <input
                    type="checkbox"
                    aria-label={tr(m.vi, m.en || m.vi)}
                    checked={checked.has(i)}
                    onChange={() => setChecked((c) => { const n = new Set(c); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className={`min-w-0 flex-1 text-sm ${checked.has(i) ? "text-slate-500 line-through" : "text-slate-200"}`}>{tr(m.vi, m.en || m.vi)}</span>
                  <span className="flex-shrink-0 text-[11px] text-slate-500">{m.qty}</span>
                  <Link href={`/supply?q=${encodeURIComponent(m.vi)}`} className="flex-shrink-0 text-[11px] font-bold text-emerald-300 hover:underline">{tr("Tìm mua", "Find")}</Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label={tr("Các bước làm", "Steps")} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-black text-white"><ListChecks className="h-4 w-4 text-sky-300" />{tr(" Các bước làm", " Steps")}</h3>
            <ol className="space-y-1.5">
              {d.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[11px] font-black text-sky-300">{i + 1}</span>
                  <span className="pt-0.5">{tr(s.vi, s.en || s.vi)}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={save} disabled={busy} className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl text-sm font-black ring-1 ${d.saved ? "bg-pink-500/15 text-pink-200 ring-pink-500/40" : "bg-white/[0.06] text-white ring-white/10"}`}>
              <Bookmark className={`h-4 w-4 ${d.saved ? "fill-pink-300" : ""}`} /> {d.saved ? tr("Đã lưu", "Saved") : tr("Lưu mẫu", "Save")}
            </button>
            <button type="button" onClick={tryIt} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white">
              <Camera className="h-4 w-4" /> {tr("Tôi làm mẫu này", "I made this")}
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-500">{tr("Làm xong? Đăng ảnh THẬT kèm ", "Done? Post a REAL photo with ")}{hashtagFor(d)}{tr(" để lên bảng xếp hạng tuần.", " to join this week's ranking.")}</p>
        </div>
      </div>
    </div>
  );
}

/** Dải "Mẫu nail AI hôm nay" trên bảng tin — ẩn khi chưa có mẫu đã duyệt. */
export function DesignsStrip() {
  useTr(); // render lại khi đổi VI/EN
  const [items, setItems] = useState<Design[] | null>(null);
  const [open, setOpen] = useState<Design | null>(null);
  useEffect(() => {
    fetch("/api/designs?limit=8")
      .then((r) => (r.ok ? r.json() : { designs: [] }))
      .then((d) => setItems(d.designs || []))
      .catch(() => setItems([]));
  }, []);
  if (!items?.length) return null;
  const update = (id: string, saved: boolean, saves: number) => {
    setItems((list) => list?.map((x) => (x.id === id ? { ...x, saved, saves } : x)) ?? null);
    setOpen((o) => (o && o.id === id ? { ...o, saved, saves } : o));
  };
  return (
    <section aria-label={tr("Mẫu nail AI mới", "New AI nail designs")} className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-black text-white"><Sparkles className="h-4 w-4 text-pink-300" />{tr(" Mẫu nail mới mỗi ngày", " Fresh nail designs daily")}</p>
        <Link href="/designs" className="flex items-center gap-0.5 text-xs font-bold text-pink-300 hover:underline">{tr("Xem tất cả", "See all")}<ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {items.map((d) => <DesignCard key={d.id} d={d} compact onOpen={() => setOpen(d)} />)}
      </div>
      {open && <DesignSheet d={open} onClose={() => setOpen(null)} onSaved={(s, n) => update(open.id, s, n)} />}
    </section>
  );
}
