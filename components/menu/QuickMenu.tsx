"use client";

import React, { useEffect, useState } from "react";
import { Check, ChevronLeft, ImageOff, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { cdnImage } from "@/lib/cdnImage";
import type { MenuCategory, PublicMenuItem } from "@/lib/menu";

// "Tạo menu nhanh từ ảnh của tôi": chọn nhiều ảnh thật (portfolio / bài khoe tay nghề) → mỗi ảnh điền
// tên + giá → lưu 1 lần. Thợ có sẵn ảnh thì lên menu trong ~2 phút, không phải nhập từng mẫu.
interface Photo { url: string; caption: string | null }
interface Row { url: string; name: string; price: string; category: MenuCategory }
const NAME_CHIPS = ["Sơn gel trơn", "French", "Mắt mèo", "Tráng gương", "Ombre", "Đính đá", "Vẽ hoạ tiết", "Bột", "Gel-X", "Chân gel"];
const MAX = 12;

export default function QuickMenu({ onClose, onDone }: { onClose: () => void; onDone: (items: PublicMenuItem[]) => void }) {
  useTr();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/menu/photos", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { photos: [] })).then((d) => setPhotos(d.photos || [])).catch(() => setPhotos([]));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && saving === null && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const toggle = (url: string) => setPicked((p) => (p.includes(url) ? p.filter((x) => x !== url) : p.length >= MAX ? (toast(tr(`Tối đa ${MAX} ảnh mỗi lần`, `Up to ${MAX} photos at a time`)), p) : [...p, url]));
  const next = () => setRows(picked.map((url) => ({ url, name: photos?.find((p) => p.url === url)?.caption ?? "", price: "", category: "HAND" })));
  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => (r ? r.map((x, k) => (k === i ? { ...x, ...patch } : x)) : r));

  const save = async () => {
    if (!rows) return;
    const bad = rows.findIndex((r) => r.name.trim().length < 2 || !(Number(r.price) >= 0 && r.price.trim()));
    if (bad >= 0) {
      toast.error(tr(`Ảnh ${bad + 1}: điền tên và giá`, `Photo ${bad + 1}: add a name and price`));
      document.getElementById(`qm-name-${bad}`)?.focus();
      return;
    }
    const done: PublicMenuItem[] = [];
    for (let i = 0; i < rows.length; i++) {
      setSaving(i);
      const r = rows[i];
      const res = await fetch("/api/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: r.name, priceFrom: r.price, category: r.category, images: [r.url] }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(`${tr("Ảnh", "Photo")} ${i + 1}: ${d.error || tr("không lưu được", "couldn't save")}`); break; }
      done.push(d.item);
    }
    setSaving(null);
    if (done.length) {
      toast.success(tr(`Đã thêm ${done.length} mẫu vào menu`, `Added ${done.length} designs to your menu`));
      onDone(done);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => saving === null && onClose()}>
      <div role="dialog" aria-label={tr("Tạo menu nhanh từ ảnh", "Quick menu from photos")} onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4">
          {rows && <button type="button" onClick={() => setRows(null)} disabled={saving !== null} aria-label={tr("Chọn lại ảnh", "Back to photos")} className="-ml-2 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"><ChevronLeft className="h-5 w-5" /></button>}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-white">{rows ? tr("Điền tên & giá", "Add names & prices") : tr("Tạo menu nhanh từ ảnh của bạn", "Quick menu from your photos")}</h2>
            <p className="text-xs text-slate-400">{rows ? tr("Giá tham khảo — có thể sửa chi tiết, vật tư sau", "Guide price — refine details and materials later") : tr("Chọn những mẫu đẹp nhất bạn đã làm", "Pick the best sets you've done")}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving !== null} aria-label={tr("Đóng", "Close")} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {photos === null ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>
          ) : photos.length === 0 ? (
            <div className="py-10 text-center">
              <ImageOff className="mx-auto h-8 w-8 text-slate-500" />
              <p className="mt-2 text-sm font-bold text-slate-200">{tr("Chưa có ảnh nào để dùng", "No photos to use yet")}</p>
              <p className="mt-1 text-xs text-slate-400">{tr("Thêm ảnh vào portfolio hoặc đăng bài “Khoe tay nghề”, rồi quay lại — hoặc bấm “Thêm mẫu” để tải ảnh mới.", "Add portfolio photos or post a showcase, then come back — or use “Add design” to upload new photos.")}</p>
            </div>
          ) : !rows ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => {
                const i = picked.indexOf(p.url);
                return (
                  <button key={p.url} type="button" onClick={() => toggle(p.url)} aria-pressed={i >= 0} aria-label={p.caption || tr("Ảnh", "Photo")} className={`relative aspect-square overflow-hidden rounded-2xl bg-slate-900 ring-2 transition-all ${i >= 0 ? "ring-pink-500" : "ring-transparent hover:ring-white/20"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cdnImage(p.url, 300)} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform ${i >= 0 ? "scale-95 rounded-xl" : ""}`} />
                    <span className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ring-2 ring-white ${i >= 0 ? "bg-pink-500 text-white" : "bg-black/40 text-transparent"}`}>{i >= 0 ? i + 1 : <Check className="h-3 w-3" />}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={r.url} className="flex gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cdnImage(r.url, 200)} alt="" className="h-20 w-20 flex-shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input id={`qm-name-${i}`} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} maxLength={80} placeholder={tr("Tên mẫu", "Design name")} aria-label={tr(`Tên mẫu ${i + 1}`, `Design name ${i + 1}`)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-base text-white placeholder-slate-500 focus:border-pink-500/60 focus:outline-none sm:text-sm" />
                      <div className="relative w-24 flex-shrink-0">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                        <input inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value.replace(/[^\d.]/g, "") })} placeholder="45" aria-label={tr(`Giá mẫu ${i + 1}`, `Price ${i + 1}`)} className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2 pl-6 pr-2 text-base text-white placeholder-slate-500 focus:border-pink-500/60 focus:outline-none sm:text-sm" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(["HAND", "FOOT"] as MenuCategory[]).map((c) => (
                        <button key={c} type="button" onClick={() => setRow(i, { category: c })} aria-pressed={r.category === c} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.category === c ? "bg-white text-slate-900" : "bg-white/[0.05] text-slate-300"}`}>{c === "HAND" ? tr("Tay", "Hands") : tr("Chân", "Feet")}</button>
                      ))}
                      <span className="mx-1 w-px self-stretch bg-white/10" />
                      {NAME_CHIPS.slice(0, 6).map((n) => (
                        <button key={n} type="button" onClick={() => setRow(i, { name: r.name.trim() ? `${r.name.trim()} ${n.toLowerCase()}` : n })} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10">+ {n}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {photos && photos.length > 0 && (
          <div className="flex items-center gap-2 border-t border-white/5 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <span className="text-xs text-slate-400">{rows ? tr(`${rows.length} mẫu`, `${rows.length} designs`) : tr(`Đã chọn ${picked.length}/${Math.min(MAX, photos.length)}`, `${picked.length} selected`)}</span>
            {rows ? (
              <button type="button" onClick={save} disabled={saving !== null} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-600/20 disabled:opacity-60">
                {saving !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving !== null ? tr(`Đang lưu ${saving + 1}/${rows.length}…`, `Saving ${saving + 1}/${rows.length}…`) : tr(`Lưu ${rows.length} mẫu vào menu`, `Save ${rows.length} to menu`)}
              </button>
            ) : (
              <button type="button" onClick={next} disabled={!picked.length} className="ml-auto rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-40">{tr("Tiếp tục", "Continue")}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
