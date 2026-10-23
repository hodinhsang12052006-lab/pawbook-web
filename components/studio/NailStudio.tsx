"use client";

// Thử mẫu PawNail (Try-On) — 3 bước: (1) chọn ảnh tay (ảnh khách gửi trong chat / chụp mới) → (2) chạm GỐC rồi ĐẦU
// từng móng — máy nhận ĐÚNG móng thật (viền hiện ngay trên ảnh) → (3) 10 mẫu theo trend vẽ thẳng lên móng thật
// như ảnh chụp: đổi màu theo ánh sáng thật của ảnh, bóng / nhám / chrome / mắt mèo / nhũ, hoạ tiết; giữ dáng
// móng thật hoặc đắp dài theo dáng. Chọn mẫu → gửi khách kèm giá / tải ảnh. Khớp khuôn + vẽ chạy nền (Web Worker).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Download, Loader2, RefreshCw, RotateCcw, Send, Sparkles, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import TryOnMotif from "@/components/studio/TryOnMotif";
import { ACCENT, ALL_NAILS } from "@/components/designs/NailArt";
import { cropBox, hasMotif, labelJpeg, loadPhoto, lookColors, studioLooks, svgPixels, type NailMark, type Pt, type StudioLook } from "@/lib/studio";
import { TryOnClient } from "@/lib/tryon/client";
import type { Crop, NailInfo, RawImg } from "@/lib/tryon/session";
import type { Shape } from "@/lib/tryon/engine";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export interface StudioResult { blobs: Blob[]; looks: StudioLook[] }

type ShapeOpt = "natural" | Shape;
const SHAPES: ShapeOpt[] = ["natural", "almond", "oval", "square", "coffin", "stiletto"];
const SHAPE_VI: Record<ShapeOpt, [string, string]> = {
  natural: ["Móng thật", "Natural"], almond: ["Hạnh nhân", "Almond"], oval: ["Oval", "Oval"], square: ["Vuông", "Square"], coffin: ["Coffin", "Coffin"], stiletto: ["Nhọn", "Stiletto"],
};
type NailState = NailInfo | "busy" | "error";
interface Preview { url: string; blob: Blob }

export default function NailStudio({ photos = [], market = "US", onSend, sendLabel }: {
  photos?: string[]; // ảnh tay có sẵn (VD khách gửi trong chat)
  market?: "US" | "AU";
  onSend?: (r: StudioResult) => Promise<void>;
  sendLabel?: string;
}) {
  useTr();
  const [photo, setPhoto] = useState<{ view: string; w: number; h: number } | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [marks, setMarks] = useState<NailMark[]>([]);
  const [nails, setNails] = useState<NailState[]>([]);
  const [pending, setPending] = useState<Pt | null>(null);
  const [step, setStep] = useState<"photo" | "mark" | "looks">("photo");
  const [salt, setSalt] = useState(() => Math.random().toString(36).slice(2, 8));
  const [shape, setShape] = useState<ShapeOpt>("natural");
  const [lengthFactor, setLengthFactor] = useState(1.35);
  const [styled, setStyled] = useState(0); // tăng mỗi lần bộ máy vẽ lại mặt nạ theo dáng mới
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const engine = useRef<TryOnClient | null>(null);
  const motifs = useRef<Record<string, SVGSVGElement | null>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  const looks = useMemo(() => studioLooks(10, market, salt), [market, salt]);
  const ready = nails.filter((n): n is NailInfo => typeof n === "object");
  const working = nails.some((n) => n === "busy");
  const crop: Crop = useMemo(() => {
    if (!photo) return { x: 0, y: 0, w: 1, h: 1 };
    const c = cropBox(marks, photo.w, photo.h, 0.32); // cắt sát bàn tay — móng to, rõ trong ảnh mẫu
    return { x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.size), h: Math.round(c.size) };
  }, [marks, photo]);

  const freeUrls = () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; };
  useEffect(() => () => { freeUrls(); engine.current?.dispose(); }, []);
  useEffect(() => () => { if (photo?.view) URL.revokeObjectURL(photo.view); }, [photo?.view]);

  const load = async (src: string | Blob) => {
    setLoadingPhoto(true);
    try {
      const p = await loadPhoto(src);
      engine.current?.dispose();
      engine.current = new TryOnClient();
      await engine.current.call({ kind: "image", img: { w: p.w, h: p.h, buffer: p.pixels.data.buffer as ArrayBuffer } });
      setPhoto({ view: URL.createObjectURL(p.blob), w: p.w, h: p.h });
      setMarks([]); setNails([]); setPending(null); setPicked(new Set()); setPreviews({}); freeUrls();
      setShape("natural"); setStep("mark");
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
    if (!pending) { setPending(p); return; }
    const mark = { base: pending, tip: p }, index = marks.length;
    setMarks((m) => [...m, mark]);
    setNails((n) => { const c = [...n]; c[index] = "busy"; return c; });
    setPending(null);
    // nhận móng ngay (chạy nền) — người dùng chạm móng tiếp theo trong lúc chờ
    engine.current?.call({ kind: "nail", index, mark }).then(
      (r) => setNails((n) => { if (n[index] !== "busy") return n; const c = [...n]; c[index] = r.kind === "nail" ? r.nail : "error"; return c; }),
      () => setNails((n) => { const c = [...n]; if (c[index] === "busy") c[index] = "error"; return c; }),
    );
  };

  const undo = () => {
    if (pending) { setPending(null); return; }
    const from = marks.length - 1;
    if (from < 0) return;
    setMarks((m) => m.slice(0, from));
    setNails((n) => n.slice(0, from));
    engine.current?.call({ kind: "remove", from }).catch(() => {});
  };

  // Quay lại chạm móng: về dáng móng thật (viền trên ảnh = đúng móng thật, không kèm phần đắp)
  const editNails = () => {
    setStep("mark");
    engine.current?.call({ kind: "style", lengthFactor: 1, shape: "oval" }).then((r) => { if (r.kind === "nails") setNails((n) => r.nails.map((x, i) => (n[i] === "busy" ? "busy" : x ?? n[i]))); }).catch(() => {});
  };

  // Đổi dáng / độ dài đắp → bộ máy vẽ lại mặt nạ từng móng (nhanh, không khớp khuôn lại)
  useEffect(() => {
    if (step !== "looks" || !engine.current || working) return;
    let live = true;
    const lf = shape === "natural" ? 1 : lengthFactor;
    const t = setTimeout(() => {
      engine.current?.call({ kind: "style", lengthFactor: lf, shape: shape === "natural" ? "oval" : shape }).then((r) => {
        if (!live || r.kind !== "nails") return;
        setNails(r.nails);
        setStyled((x) => x + 1);
      }).catch(() => {});
    }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [step, shape, lengthFactor, working]);

  // Vẽ lần lượt 10 mẫu (chạy nền) mỗi khi bộ mẫu / dáng móng đổi
  const renderAll = useCallback(async (isLive: () => boolean) => {
    if (!engine.current || !photo) return;
    for (const look of looks) {
      if (!isLive()) return;
      let motif: RawImg | null = null;
      const svg = motifs.current[look.id];
      if (svg && ready.some((_, i) => hasMotif(look.pattern, i, ready.length, ALL_NAILS, ACCENT))) {
        try { const px = await svgPixels(svg, crop.w, crop.h); motif = { w: crop.w, h: crop.h, buffer: px.data.buffer as ArrayBuffer }; } catch { motif = null; }
      }
      try {
        const r = await engine.current.call({ kind: "render", look: lookColors(look), motif, crop });
        if (!isLive() || r.kind !== "image") return;
        const c = document.createElement("canvas");
        c.width = r.img.w; c.height = r.img.h;
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.img.buffer), r.img.w, r.img.h), 0, 0);
        const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("blob"))), "image/jpeg", 0.9));
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setPreviews((p) => ({ ...p, [look.id]: { url, blob } }));
      } catch {
        if (!isLive()) return;
      }
    }
  }, [looks, photo, crop, ready]);

  useEffect(() => {
    if (step !== "looks" || working || !ready.length || !styled) return;
    let live = true;
    // chờ lớp hoạ tiết (SVG ẩn) gắn vào trang rồi mới vẽ (bỏ ảnh mẫu cũ — dáng / bộ mẫu đã đổi)
    const t = setTimeout(() => { setPreviews({}); renderAll(() => live); }, 30);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, styled, salt]);

  const exportPicked = async (): Promise<StudioResult> => {
    const chosen = looks.filter((l) => picked.has(l.id) && previews[l.id]);
    const blobs: Blob[] = [];
    for (const l of chosen) {
      const bmp = await createImageBitmap(previews[l.id].blob);
      blobs.push(await labelJpeg(bmp));
      bmp.close();
    }
    return { blobs, looks: chosen };
  };

  const send = async () => {
    if (!picked.size) return toast.error(tr("Chọn ít nhất 1 mẫu.", "Pick at least one look."));
    setBusy(true);
    try {
      const r = await exportPicked();
      if (!r.blobs.length) throw new Error(tr("Mẫu đang vẽ — đợi 1 chút.", "Still painting — one moment."));
      if (onSend) await onSend(r);
      else {
        r.blobs.forEach((b, i) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = `pawnail-tryon-${i + 1}.jpg`;
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
  const plain = nails.findIndex((n) => typeof n === "object" && !n.byColor);
  const sw = photo ? photo.w / 160 : 1;

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
            <svg viewBox={`0 0 ${photo.w} ${photo.h}`} className="pointer-events-none absolute inset-0 h-full w-full" data-testid="nail-overlay">
              {marks.map((m, i) => {
                const n = nails[i];
                const label = n && typeof n === "object" ? n.geo.tip : m.tip;
                return (
                  <g key={i}>
                    {n && typeof n === "object" ? (
                      // viền móng máy đã nhận — đúng mép móng thật (xanh: nhận theo màu; vàng: móng gần màu da, theo 2 điểm chạm)
                      <polygon data-nail={i} data-bycolor={n.byColor ? "1" : "0"} points={n.outline.map((q) => `${q.x},${q.y}`).join(" ")} fill={n.byColor ? "rgba(236,72,153,0.18)" : "rgba(251,191,36,0.16)"} stroke={n.byColor ? "#f472b6" : "#fbbf24"} strokeWidth={sw * 0.7} strokeLinejoin="round" />
                    ) : (
                      <line x1={m.base.x} y1={m.base.y} x2={m.tip.x} y2={m.tip.y} stroke="#ec4899" strokeWidth={sw} strokeLinecap="round" strokeDasharray={n === "busy" ? `${sw * 2} ${sw * 2}` : undefined} opacity={0.9} />
                    )}
                    <circle cx={m.base.x} cy={m.base.y} r={photo.w / 120} fill="#fff" stroke="#ec4899" strokeWidth={photo.w / 400} />
                    <text x={label.x} y={label.y - photo.w / 45} fontSize={photo.w / 30} fontWeight={800} fill="#fff" stroke="#000" strokeWidth={photo.w / 700} textAnchor="middle">{i + 1}</text>
                  </g>
                );
              })}
              {pending && <circle cx={pending.x} cy={pending.y} r={photo.w / 70} fill="#ec4899" stroke="#fff" strokeWidth={photo.w / 300} />}
            </svg>
          </div>
          <p className="min-h-[20px] text-xs text-slate-400" aria-live="polite">
            {working
              ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />{tr("Đang nhận móng…", "Finding the nail…")}</span>
              : plain >= 0
                ? tr(`Móng ${plain + 1} gần màu da — máy vẽ theo 2 điểm chạm (viền vàng). Chạm sát gốc / đầu móng cho chuẩn.`, `Nail ${plain + 1} is close to skin tone — outlined from your taps (yellow). Tap right at the base / tip.`)
                : ready.length
                  ? tr(`Đã nhận ${ready.length} móng — viền hồng là đúng mép móng. Sai móng nào thì Hoàn tác.`, `${ready.length} nails found — the pink outline follows each nail. Undo any that look off.`)
                  : ""}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={undo} disabled={!pending && !marks.length} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10 disabled:opacity-40"><Undo2 className="h-4 w-4" />{tr("Hoàn tác", "Undo")}</button>
            <button type="button" onClick={() => { setPhoto(null); setStep("photo"); }} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><RotateCcw className="h-4 w-4" />{tr("Ảnh khác", "New photo")}</button>
            <button type="button" onClick={() => { setPicked(new Set()); setStyled(0); setStep("looks"); }} disabled={!marks.length} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-40"><Sparkles className="h-4 w-4" />{tr("Tạo mẫu", "Create")}</button>
          </div>
        </section>
      )}

      {photo && step === "looks" && (
        <section className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {SHAPES.map((s) => <button key={s} type="button" onClick={() => setShape(s)} className={pill(shape === s)}>{tr(SHAPE_VI[s][0], SHAPE_VI[s][1])}</button>)}
          </div>
          {shape !== "natural" && (
            <label className="block space-y-1 text-xs text-slate-400">{tr("Độ dài đắp", "Extension length")}
              <input type="range" min={1.1} max={1.9} step={0.05} value={lengthFactor} onChange={(e) => setLengthFactor(Number(e.target.value))} className="w-full accent-pink-500" />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {looks.map((l) => {
              const on = picked.has(l.id), pv = previews[l.id];
              return (
                <button key={l.id} type="button" onClick={() => setPicked((p) => { const n = new Set(p); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} aria-pressed={on} className={`relative overflow-hidden rounded-2xl text-left ring-2 transition ${on ? "ring-pink-500" : "ring-white/10"}`}>
                  {pv ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pv.url} alt={tr(l.title.vi, l.title.en)} data-look={l.id} className="block aspect-square w-full bg-black object-cover" />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center bg-white/[0.04]" data-look-pending={l.id}><Loader2 className="h-6 w-6 animate-spin text-pink-300/70" /></span>
                  )}
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
            <button type="button" onClick={editNails} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><Undo2 className="h-4 w-4" />{tr("Sửa móng", "Edit nails")}</button>
            <button type="button" onClick={() => { setSalt(Math.random().toString(36).slice(2, 8)); setPicked(new Set()); }} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-sm font-bold text-slate-200 ring-1 ring-white/10"><RefreshCw className="h-4 w-4" />{tr("Bộ khác", "New set")}</button>
            <button type="button" onClick={send} disabled={busy || !picked.size} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : onSend ? <Send className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {onSend ? (sendLabel || tr(`Gửi ${picked.size || ""}`, `Send ${picked.size || ""}`)) : tr(`Tải ${picked.size || ""}`, `Save ${picked.size || ""}`)}
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-500">{tr("Ảnh mẫu thử do PawNail vẽ lên tay khách — giá là giá tham khảo, báo giá chính xác theo menu tiệm.", "Try-on previews drawn by PawNail — prices are estimates; quote from your menu.")}</p>
          {/* lớp hoạ tiết từng mẫu (ẩn) — bộ máy chuyển thành điểm ảnh rồi phủ lên móng thật */}
          <div className="hidden" aria-hidden>
            {looks.map((l) => <TryOnMotif key={l.id} ref={(el) => { motifs.current[l.id] = el; }} look={l} nails={ready} crop={crop} />)}
          </div>
        </section>
      )}
    </div>
  );
}
