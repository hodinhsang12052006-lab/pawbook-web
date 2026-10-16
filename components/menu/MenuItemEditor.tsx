"use client";

import React, { useMemo, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { uploadMedia } from "@/lib/mediaUpload";
import { CATEGORY_LABEL, MAX_MENU_IMAGES, MENU_CATEGORIES, TECHNIQUES, materialCost, priceLabel, type MenuCategory, type MenuMaterial, type PublicMenuItem } from "@/lib/menu";

// Thêm / sửa 1 mẫu trong menu. Phần "Vật tư" chỉ chủ menu thấy: nhập giá mua → tự tính chi phí + lời.
const COMMON_MATERIALS = ["Base gel", "Top gel", "Gel màu", "Bột acrylic", "Dung dịch (monomer)", "Bột dip", "Activator", "Tips Gel-X", "Bột chrome", "Đá / charm", "Sticker / foil", "Dầu dưỡng da", "Giũa + buffer", "Bông + giấy lau"];

export default function MenuItemEditor({ item, knownMaterials, onClose, onSaved, onDeleted }: {
  item: PublicMenuItem | null; // null = thêm mới
  knownMaterials: string[];
  onClose: () => void;
  onSaved: (it: PublicMenuItem) => void;
  onDeleted?: (id: string) => void;
}) {
  useTr();
  const [category, setCategory] = useState<MenuCategory>(item?.category ?? "HAND");
  const [name, setName] = useState(item?.name ?? "");
  const [technique, setTechnique] = useState(item?.technique ?? "");
  const [priceFrom, setPriceFrom] = useState(item ? String(item.priceFrom) : "");
  const [priceTo, setPriceTo] = useState(item?.priceTo ? String(item.priceTo) : "");
  const [minutes, setMinutes] = useState(item?.minutes ? String(item.minutes) : "");
  const [weeks, setWeeks] = useState(item?.durabilityWeeks ? String(item.durabilityWeeks) : "");
  const [difficulty, setDifficulty] = useState<number | null>(item?.difficulty ?? null);
  const [description, setDescription] = useState(item?.description ?? "");
  const [images, setImages] = useState<string[]>(item?.images ?? []);
  const [materials, setMaterials] = useState<MenuMaterial[]>(item?.materials?.length ? item.materials : [{ name: "", qty: "", cost: null }]);
  const [active, setActive] = useState(item?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const cost = useMemo(() => materialCost(materials.filter((m) => m.name.trim())), [materials]);
  const pf = Number(priceFrom) || 0;
  const pt = Number(priceTo) || 0;
  const suggestions = useMemo(() => Array.from(new Set([...knownMaterials, ...COMMON_MATERIALS])), [knownMaterials]);

  const addPhoto = () => {
    if (images.length >= MAX_MENU_IMAGES) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setUploading(true);
      try {
        const url = await uploadMedia(f);
        setImages((p) => [...p, url].slice(0, MAX_MENU_IMAGES));
      } catch (e) {
        toast.error((e as Error).message || tr("Tải ảnh thất bại.", "Upload failed."));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const setMat = (i: number, patch: Partial<MenuMaterial>) => setMaterials((p) => p.map((m, k) => (k === i ? { ...m, ...patch } : m)));

  const save = async () => {
    if (name.trim().length < 2) return toast.error(tr("Nhập tên mẫu.", "Enter a name."));
    if (!priceFrom.trim()) return toast.error(tr("Nhập giá.", "Enter a price."));
    setBusy(true);
    const body = {
      category, name, technique, priceFrom, priceTo: priceTo || null, minutes: minutes || null, durabilityWeeks: weeks || null, difficulty,
      description, images, materials: materials.filter((m) => m.name.trim()), active, sourceDesignId: item?.sourceDesignId ?? null,
    };
    try {
      const res = await fetch(item ? `/api/menu/${item.id}` : "/api/menu", { method: item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || tr("Lưu thất bại.", "Couldn't save."));
      toast.success(item ? tr("Đã lưu mẫu", "Saved") : tr("Đã thêm vào menu", "Added to your menu"));
      onSaved(d.item);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item || !confirm(tr(`Xoá "${item.name}" khỏi menu?`, `Delete "${item.name}" from your menu?`))) return;
    setBusy(true);
    const res = await fetch(`/api/menu/${item.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) { toast.success(tr("Đã xoá", "Deleted")); onDeleted?.(item.id); } else toast.error(tr("Xoá thất bại.", "Couldn't delete."));
  };

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-base text-slate-100 placeholder-slate-500 focus:border-pink-500/60 focus:outline-none sm:text-sm";
  const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label={item ? tr("Sửa mẫu", "Edit design") : tr("Thêm mẫu vào menu", "Add to menu")} onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-base font-black text-white">{item ? tr("Sửa mẫu", "Edit design") : tr("Thêm mẫu vào menu", "Add to menu")}</h2>
          <button type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Ảnh thật */}
          <div>
            <span className={label}>{tr("Ảnh thật bạn làm", "Photos of your work")} <span className="normal-case text-slate-500">({images.length}/{MAX_MENU_IMAGES})</span></span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((u, i) => (
                <div key={u} className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">{tr("Ảnh bìa", "Cover")}</span>}
                  <button type="button" onClick={() => setImages((p) => p.filter((x) => x !== u))} aria-label={tr("Bỏ ảnh", "Remove photo")} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {images.length < MAX_MENU_IMAGES && (
                <button type="button" onClick={addPhoto} disabled={uploading} className="flex h-24 w-24 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-white/15 text-xs font-bold text-slate-400 hover:border-pink-500/50 hover:text-pink-300">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  {tr("Thêm ảnh", "Add photo")}
                </button>
              )}
            </div>
          </div>

          <div>
            <span className={label}>{tr("Nhóm", "Category")}</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {MENU_CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors ${category === c ? "bg-white text-slate-900" : "bg-white/[0.05] text-slate-300 hover:bg-white/10"}`}>{tr(CATEGORY_LABEL[c][0], CATEGORY_LABEL[c][1])}</button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={label}>{tr("Tên mẫu", "Design name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={tr("VD: French tráng gương ngắn", "e.g. Short mirror French")} className={field} />
          </label>

          {category !== "ADDON" && (
            <div>
              <span className={label}>{tr("Kỹ thuật", "Technique")}</span>
              <div className="flex flex-wrap gap-1.5">
                {TECHNIQUES.map((t) => (
                  <button key={t} type="button" onClick={() => setTechnique(technique === t ? "" : t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${technique === t ? "bg-pink-500 text-white" : "bg-white/[0.05] text-slate-300 hover:bg-white/10"}`}>{t}</button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={label}>{tr("Giá từ ($)", "Price from ($)")}</span><input inputMode="decimal" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value.replace(/[^\d.]/g, ""))} placeholder="45" className={field} /></label>
            <label className="block"><span className={label}>{tr("Đến ($, nếu có)", "Up to ($, optional)")}</span><input inputMode="decimal" value={priceTo} onChange={(e) => setPriceTo(e.target.value.replace(/[^\d.]/g, ""))} placeholder="60" className={field} /></label>
            {category !== "ADDON" && (
              <>
                <label className="block"><span className={label}>{tr("Thời gian (phút)", "Time (min)")}</span><input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} placeholder="60" className={field} /></label>
                <label className="block"><span className={label}>{tr("Giữ được (tuần)", "Lasts (weeks)")}</span><input inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value.replace(/\D/g, ""))} placeholder="3" className={field} /></label>
              </>
            )}
          </div>

          {category !== "ADDON" && (
            <div>
              <span className={label}>{tr("Độ khó", "Difficulty")}</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[[1, tr("Dễ", "Easy")], [2, tr("Vừa", "Medium")], [3, tr("Khó", "Advanced")]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setDifficulty(difficulty === v ? null : (v as number))} className={`rounded-xl py-2 text-xs font-bold ${difficulty === v ? "bg-white text-slate-900" : "bg-white/[0.05] text-slate-300 hover:bg-white/10"}`}>{l}</button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className={label}>{tr("Mô tả cho khách", "Description for clients")}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} placeholder={tr("Hợp đi làm, đi tiệc… dáng móng, màu có thể đổi…", "Great for work or parties… shape and colors can be changed…")} className={`${field} resize-none`} />
          </label>

          {/* Vật tư — chỉ mình thấy */}
          <div className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/10">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Vật tư (chỉ bạn thấy)", "Materials (only you see this)")}</span>
              <button type="button" onClick={() => setMaterials((p) => [...p, { name: "", qty: "", cost: null }])} className="inline-flex items-center gap-1 text-xs font-bold text-pink-300 hover:text-pink-200"><Plus className="h-3.5 w-3.5" />{tr("Thêm dòng", "Add row")}</button>
            </div>
            <datalist id="pn-materials">{suggestions.map((m) => <option key={m} value={m} />)}</datalist>
            <div className="space-y-1.5">
              {materials.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_72px_28px] items-center gap-1.5">
                  <input list="pn-materials" value={m.name} onChange={(e) => setMat(i, { name: e.target.value })} placeholder={tr("Vật tư", "Material")} className={`${field} py-2`} aria-label={tr("Tên vật tư", "Material name")} />
                  <input value={m.qty} onChange={(e) => setMat(i, { qty: e.target.value })} placeholder={tr("SL", "Qty")} className={`${field} py-2`} aria-label={tr("Số lượng", "Quantity")} />
                  <input inputMode="decimal" value={m.cost ?? ""} onChange={(e) => setMat(i, { cost: e.target.value.trim() ? Number(e.target.value.replace(/[^\d.]/g, "")) : null })} placeholder="$" className={`${field} py-2`} aria-label={tr("Chi phí", "Cost")} />
                  <button type="button" onClick={() => setMaterials((p) => p.filter((_, k) => k !== i))} aria-label={tr("Xoá dòng", "Remove row")} className="flex h-8 w-7 items-center justify-center text-slate-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            {cost !== null && pf > 0 && (
              <p className="mt-2.5 text-xs text-slate-300">
                {tr("Chi phí vật tư", "Material cost")} <b className="text-white">${cost.toFixed(2)}</b> · {tr("Lời ước tính", "Est. margin")}{" "}
                <b className="text-emerald-300">{priceLabel(Math.max(0, Math.round(pf - cost)), pt > pf ? Math.round(pt - cost) : null)}</b>
              </p>
            )}
          </div>

          <label className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/10">
            <span className="text-sm font-semibold text-slate-200">{tr("Hiện trong menu cho khách", "Show in my public menu")}</span>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-pink-500" />
          </label>
        </div>

        <div className="flex items-center gap-2 border-t border-white/5 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {item && (
            <button type="button" onClick={remove} disabled={busy} className="rounded-xl px-3 py-2.5 text-sm font-bold text-rose-400 hover:bg-rose-500/10 disabled:opacity-50">{tr("Xoá", "Delete")}</button>
          )}
          <button type="button" onClick={onClose} className="ml-auto rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5">{tr("Huỷ", "Cancel")}</button>
          <button type="button" onClick={save} disabled={busy || uploading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-600/20 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Lưu", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
