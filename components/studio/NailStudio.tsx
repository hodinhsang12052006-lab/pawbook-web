"use client";

// Thử mẫu PawNail (Try-On) — 3 bước: (1) chọn ảnh tay (ảnh khách gửi trong chat / chụp mới) → (2) chạm GỐC rồi ĐẦU
// từng móng → (3) máy tạo 10 mẫu theo trend vẽ thẳng lên tay khách; chọn mẫu → gửi khách kèm giá / tải ảnh.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Loader2, RefreshCw, RotateCcw, Send, Sparkles, Undo2, Download } from "lucide-react";
import toast from "react-hot-toast";
import TryOnLook from "@/components/studio/TryOnLook";
import { cropBox, studioLooks, svgToJpeg, toDataUrl, type NailMark, type Pt, type StudioLook } from "@/lib/studio";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export interface StudioResult { blobs: Blob[]; looks: StudioLook[] }

const SHAPES = ["auto", "almond", "oval", "square", "coffin", "stiletto"] as const;
const SHAPE_VI: Record<string, string> = { auto: "Theo mẫu", almond: "Hạnh nhân", oval: "Oval", square: "Vuông", coffin: "Coffin", stiletto: "Nhọn" };

export default function NailStudio({ photos = [], market = "US", onSend, sendLabel }: {
  photos?: string[]; // ảnh tay có sẵn (VD khách gửi trong chat)
  market?: "US" | "AU";
  onSend?: (r: StudioResult) => Promise<void>;
  sendLabel?: string;
}) {
  useTr();
  const [photo, setPhoto] = useState<{ data: string; view: string; w: number; h: number } | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [marks, setMarks] = useState<NailMark[]>([]);
  const [pending, setPending] = useState<Pt | null>(null);
  const [step, setStep] = useState<"photo" | "mark" | "looks">("photo");
  const [salt, setSalt] = useState(() => Math.random().toString(36).slice(2, 8));
  const [shape, setShape] = useState<(typeof SHAPES)[number]>("auto");
  const [widthRatio, setWidthRatio] = useState(0.86);
  const [lengthFactor, setLengthFactor] = useState(1.15);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const refs = useRef<Record<string, SVGSVGElement | null>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const looks = useMemo(() => studioLooks(10, market, salt, shape === "auto" ? {} : { shape }), [market, salt, shape]);
  const crop = useMemo(() => (photo ? cropBox(marks, photo.w, photo.h) : { x: 0, y: 0, size: 1 }), [marks, photo]);
  useEffect(() => () => { if (photo?.view) URL.revokeObjectURL(photo.view); }, [photo?.view]);

  const load = async (src: string | Blob) => {
    setLoadingPhoto(true);
    try {
      const p = await toDataUrl(src);
      const view = URL.createObjectURL(p.blob);
      setPhoto({ data: p.url, view, w: p.w, h: p.h });
      setMarks([]); setPending(null); setPicked(new Set()); setStep("mark");
    } catch {
      toast.error(tr("Không mở được ảnh này — thử ảnh khác.", "Couldn't open this photo — try another."));
    } finally {
      setLoadingPhoto(false);
    }
  };

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!photo || step !== "mark" || marks.length >= 5) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * photo.w, y: ((e.clientY - r.top) / r.height) * photo.h };
    if (!pending) setPending(p);
    else { setMarks((m) => [...m, { base: pending, tip: p }]); setPending(null); }
  };

  const exportPicked = async (): Promise<StudioResult> => {
    const chosen = looks.filter((l) => picked.has(l.id));
    const blobs: Blob[] = [];
    for (const l of chosen) {
      const svg = refs.current[l.id];
      if (!svg || !photo) continue;
      // Bản xuất: nhúng ảnh data URL (SVG-làm-ảnh không tải được blob:/link ngoài)
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll("image").forEach((im) => { im.setAttribute("href", photo.data); im.setAttribute("xlink:href", photo.data); });
      blobs.push(await svgToJpeg(clone));
    }
    return { blobs, looks: chosen };
  };

  const send = async () => {
    if (!picked.size) return toast.error(tr("Chọn ít nhất 1 mẫu.", "Pick at least one look."));
    setBusy(true);
    try {
      const r = await exportPicked();
      if (onSend) await onSend(r);
      else {
        r.blobs.forEach((b, i) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = `pawnail-studio-${i + 1}.jpg`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        });
        toast.success(tr(`Đã tải ${r.blobs.length} ảnh mẫu.`, `Saved ${r.blobs.length} looks.`));
      }
    } catch (e) {
      toast.error((e as Error).message || tr("Không xuất được ảnh.", "Couldn't export."));
    } finally {
      setBusy(false);
    }
  };

  const pill = (on: boolean) => `min-h-[34px] flex-shrink-0 rounded-full px-3 text-xs font-bold ${on ? "bg-pink-600 text-white" : "bg-white/[0.06] text-slate-300 ring-1 ring-white/10"}`;

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />

      {step === "photo" && (
        <section className="space-y-3">
          <p className="text-sm text-slate-300">{tr("Chọn ảnh bàn tay (mu bàn tay, thấy rõ móng, đủ sáng):", "Pick a hand photo (back of the hand, nails clearly visible, good light):")}</p>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 6).map((u) => (
                <button key={u} type="button" onClick={() => load(u)} className="overflow-hidden rounded-2xl ring-1 ring-white/10 hover:ring-pink-400/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={loadingPhoto} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-60">
            {loadingPhoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}{tr("Chụp / chọn ảnh tay", "Take / choose a hand photo")}
          </button>
        </section>
      )}

      {photo && step === "mark" && (
        <section className="space-y-3">
          {/* Cao CỐ ĐỊNH: chữ hướng dẫn đổi giữa 2 lần chạm mà đổi chiều cao thì ảnh nhảy → chạm lệch móng */}
          <p className="flex min-h-[68px] items-center rounded-2xl bg-white/[0.04] px-3.5 py-2.5 text-sm leading-snug text-slate-200 ring-1 ring-white/10" aria-live="polite">
            {pending
              ? tr("Giờ chạm vào ĐẦU móng đó (mép móng phía ngoài).", "Now tap the TIP of that nail (free edge).")
              : marks.length < 5
                ? tr(`Móng ${marks.length + 1}: chạm vào GỐC móng (sát da), rồi chạm ĐẦU móng. Đi lần lượt ngón cái → út.`, `Nail ${marks.length + 1}: tap the BASE (at the cuticle), then the TIP. Go thumb → pinky.`)
                : tr("Đã đủ 5 móng — bấm Tạo mẫu.", "All 5 nails marked — tap Create looks.")}
          </p>
          <div className="relative cursor-crosshair overflow-hidden rounded-2xl ring-1 ring-white/10" onClick={tap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.view} alt={tr("Ảnh tay khách", "Client's hand")} className="block w-full select-none" draggable={false} />
            <svg viewBox={`0 0 ${photo.w} ${photo.h}`} className="pointer-events-none absolute inset-0 h-full w-full">
              {marks.map((m, i) => (
                <g key={i}>
                  <line x1={m.base.x} y1={m.base.y} x2={m.tip.x} y2={m.tip.y} stroke="#ec4899" strokeWidth={photo.w / 160} strokeLinecap="round" />
                  <circle cx={m.base.x} cy={m.base.y} r={photo.w / 90} fill="#fff" stroke="#ec4899" strokeWidth={photo.w / 300} />
                  <text x={m.tip.x} y={m.tip.y - photo.w / 50} fontSize={photo.w / 28} fontWeight={800} fill="#fff" stroke="#000" strokeWidth={photo.w / 600} textAnchor="middle">{i + 1}</text>
                </g>
              ))}
              {pending && <circle cx={pending.x} cy={pending.y} r={photo.w / 70} fill="#ec4899" stroke="#fff" strokeWidth={photo.w / 300} />}
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => { if (pending) setPending(null); else setMarks((m) => m.slice(0, -1)); }} disabled={!pending && !marks.length} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10 disabled:opacity-40"><Undo2 className="h-4 w-4" />{tr("Hoàn tác", "Undo")}</button>
            <button type="button" onClick={() => { setPhoto(null); setStep("photo"); }} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><RotateCcw className="h-4 w-4" />{tr("Ảnh khác", "New photo")}</button>
            <button type="button" onClick={() => setStep("looks")} disabled={!marks.length} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-40"><Sparkles className="h-4 w-4" />{tr("Tạo mẫu", "Create")}</button>
          </div>
        </section>
      )}

      {photo && step === "looks" && (
        <section className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {SHAPES.map((s) => <button key={s} type="button" onClick={() => setShape(s)} className={pill(shape === s)}>{tr(SHAPE_VI[s], s === "auto" ? "Auto" : s)}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            <label className="space-y-1">{tr("Bề ngang móng", "Nail width")}<input type="range" min={0.55} max={1.05} step={0.01} value={widthRatio} onChange={(e) => setWidthRatio(Number(e.target.value))} className="w-full accent-pink-500" /></label>
            <label className="space-y-1">{tr("Độ dài móng", "Nail length")}<input type="range" min={1} max={1.9} step={0.01} value={lengthFactor} onChange={(e) => setLengthFactor(Number(e.target.value))} className="w-full accent-pink-500" /></label>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {looks.map((l) => {
              const on = picked.has(l.id);
              return (
                <button key={l.id} type="button" onClick={() => setPicked((p) => { const n = new Set(p); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} aria-pressed={on} className={`relative overflow-hidden rounded-2xl text-left ring-2 transition ${on ? "ring-pink-500" : "ring-white/10"}`}>
                  <TryOnLook ref={(el) => { refs.current[l.id] = el; }} href={photo.view} w={photo.w} h={photo.h} marks={marks} look={l} crop={crop} widthRatio={widthRatio} lengthFactor={lengthFactor} className="block aspect-square w-full bg-black" />
                  {on && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-pink-600"><Check className="h-4 w-4 text-white" /></span>}
                  <span className="block bg-slate-950/90 px-2.5 py-2">
                    <span className="block truncate text-[12px] font-bold text-white">{tr(l.title.vi, l.title.en)}</span>
                    <span className="block text-[11px] font-semibold text-emerald-300">{l.priceHint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setStep("mark")} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><Undo2 className="h-4 w-4" />{tr("Sửa móng", "Edit nails")}</button>
            <button type="button" onClick={() => { setSalt(Math.random().toString(36).slice(2, 8)); setPicked(new Set()); }} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><RefreshCw className="h-4 w-4" />{tr("Bộ khác", "New set")}</button>
            <button type="button" onClick={send} disabled={busy || !picked.size} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : onSend ? <Send className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {onSend ? (sendLabel || tr(`Gửi ${picked.size || ""}`, `Send ${picked.size || ""}`)) : tr(`Tải ${picked.size || ""}`, `Save ${picked.size || ""}`)}
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-500">{tr("Ảnh mẫu thử do PawNail vẽ lên tay khách — giá là giá tham khảo, báo giá chính xác theo menu tiệm.", "Try-on previews drawn by PawNail — prices are estimates; quote from your menu.")}</p>
        </section>
      )}
    </div>
  );
}
