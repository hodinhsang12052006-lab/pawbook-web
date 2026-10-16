"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, Camera, CheckCircle2, Clock, Hand, ImagePlus, Loader2, Pencil, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { useSessionUser } from "@/lib/SessionUserContext";
import { cdnImage } from "@/lib/cdnImage";
import { priceLabel, type PublicMenuItem } from "@/lib/menu";
import { DesignCard, DesignSheet, type Design } from "@/components/designs/DesignViews";
import {
  BED_WIDTHS, CONDITIONS, CONDITION_IDS, FINGER_LENGTHS, LABELS, NAIL_LENGTHS, SKIN_TONES, UNDERTONES, buildAdvice,
  type Advice, type Part, type Perception, type Prefs, type Shape,
} from "@/lib/handConsult";

type L = [string, string];
const t = (l: L) => tr(l[0], l[1]);

interface Result { perception: Perception; note: string; noteEn?: string; provider: string; advice: Advice; designs: Design[]; menu: PublicMenuItem[]; menuTotal: number }

const OCCASIONS: { id: NonNullable<Prefs["occasion"]>; label: L }[] = [
  { id: "daily", label: ["Hằng ngày", "Everyday"] }, { id: "work", label: ["Đi làm", "Work"] }, { id: "party", label: ["Đi tiệc", "Party"] },
  { id: "wedding", label: ["Cưới / sự kiện", "Wedding / event"] }, { id: "vacation", label: ["Du lịch", "Vacation"] },
];
const LENGTHS: { id: NonNullable<Prefs["length"]>; label: L }[] = [{ id: "short", label: ["Ngắn", "Short"] }, { id: "medium", label: ["Vừa", "Medium"] }, { id: "long", label: ["Dài", "Long"] }];
const VIBES: { id: NonNullable<Prefs["vibe"]>; label: L }[] = [{ id: "natural", label: ["Tự nhiên", "Natural"] }, { id: "cute", label: ["Dễ thương", "Cute"] }, { id: "bold", label: ["Nổi bật", "Bold"] }];

const SHAPE_PATH: Record<Shape, string> = {
  round: "M5 34V15a7 7 0 0 1 14 0v19", oval: "M5 34V14C5 4 19 4 19 14v20", squoval: "M5 34V8q0-4 4-4h6q4 0 4 4v26", square: "M5 34V4h14v30",
  almond: "M5 34V17C5 10 10 2 12 2s7 8 7 15v17", coffin: "M5 34V13l3-10h8l3 10v21", stiletto: "M5 34V19L12 1l7 18v15",
};
function ShapeIcon({ id, className = "" }: { id: Shape; className?: string }) {
  return (
    <svg viewBox="0 0 24 36" className={className} aria-hidden>
      <path d={SHAPE_PATH[id]} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

/** Thu nhỏ ảnh ngay trên máy (≤1024px, JPEG) — gửi nhanh trên 4G, không cần lưu ở đâu. */
async function shrink(file: File): Promise<{ dataUrl: string; preview: string }> {
  const preview = URL.createObjectURL(file);
  const img = new Image();
  img.src = preview;
  await img.decode();
  const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL("image/jpeg", 0.82), preview };
}

const DEFAULT_PERCEPTION = (part: Part): Perception => ({ part, skinTone: "medium", undertone: "neutral", fingerLength: "medium", bedWidth: "medium", nailLength: "short", currentShape: null, hasProduct: false, conditions: [] });

export default function HandConsult() {
  useTr();
  const { user, loading: userLoading } = useSessionUser();
  const [part, setPart] = useState<Part>("HAND");
  const [consent, setConsent] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<"start" | "loading" | "result">("start");
  const [result, setResult] = useState<Result | null>(null);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<Design | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/consult", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, d };
  }, []);

  const needConsent = () => toast.error(tr("Hỏi ý khách và đánh dấu “Khách đồng ý” trước khi chụp.", "Ask the client and tick “Client agrees” before taking a photo."));
  const analyse = async (file: File) => {
    if (!consent) { needConsent(); return; }
    let shrunk: { dataUrl: string; preview: string };
    try { shrunk = await shrink(file); } catch { toast.error(tr("Không đọc được ảnh, thử ảnh khác.", "Couldn't read that photo, try another.")); return; }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(shrunk.preview);
    setPhase("loading");
    setEditing(false);
    const r = await post({ image: shrunk.dataUrl, part, prefs });
    if (r.ok) {
      setResult(r.d);
      setPhase("result");
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    if (r.d.code === "AI_UNAVAILABLE") {
      toast(r.d.error);
      await manual();
      return;
    }
    toast.error(r.d.error || tr("Không soi được, thử lại.", "Couldn't analyse, try again."));
    setPhase("start");
  };

  // Không cần ảnh: thợ tự chọn tình trạng (hoặc AI đang bận)
  const manual = async (p?: Perception) => {
    const perception = p ?? DEFAULT_PERCEPTION(part);
    setPhase("loading");
    const r = await post({ perception, part, prefs });
    if (!r.ok) { toast.error(r.d.error || tr("Có lỗi, thử lại.", "Something went wrong.")); setPhase("start"); return; }
    setResult({ ...r.d, provider: "manual" });
    setEditing(true);
    setPhase("result");
  };

  // Thợ sửa kết quả → lời khuyên tính lại ngay trên máy, mẫu gợi ý tải lại (không gọi AI)
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = (patch: Partial<Perception>) => {
    if (!result) return;
    const perception = { ...result.perception, ...patch };
    setResult({ ...result, perception, advice: buildAdvice(perception, prefs) });
    if (editTimer.current) clearTimeout(editTimer.current);
    editTimer.current = setTimeout(async () => {
      setRefreshing(true);
      const r = await post({ perception, part: perception.part, prefs });
      setRefreshing(false);
      if (r.ok) setResult((cur) => (cur ? { ...cur, designs: r.d.designs, menu: r.d.menu, menuTotal: r.d.menuTotal } : cur));
    }, 450);
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setResult(null);
    setPhase("start");
    setEditing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (userLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>;
  if (!user || (user.role !== "TECHNICIAN" && user.role !== "OWNER" && user.role !== "ADMIN")) {
    return (
      <div className="rounded-3xl bg-white/[0.03] p-8 text-center ring-1 ring-white/10">
        <Hand className="mx-auto h-10 w-10 text-pink-300" />
        <h1 className="mt-3 text-xl font-black text-white">{tr("Soi tay tư vấn", "Hand consultation")}</h1>
        <p className="mt-2 text-sm text-slate-400">{tr("Công cụ dành cho thợ nail và chủ tiệm: chụp tay khách → tình trạng, quy trình và mẫu hợp nhất.", "A tool for nail techs and salon owners: snap a client's hand → condition, service plan and best-matching designs.")}</p>
        {!user && <Link href="/auth/login?callbackUrl=%2Fconsult" className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white">{tr("Đăng nhập", "Log in")}</Link>}
      </div>
    );
  }

  return (
    <div className="space-y-5" ref={topRef}>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-white"><Hand className="h-6 w-6 text-pink-300" />{tr("Soi tay tư vấn", "Hand consultation")}</h1>
        <p className="text-sm text-slate-400">{tr("Chụp tay khách → xem tình trạng, quy trình nên làm và những mẫu hợp nhất. Đưa điện thoại cho khách xem cùng.", "Snap the client's hand → see its condition, the right service plan and the best-matching designs. Show the client your screen.")}</p>
      </header>

      {phase === "start" && (
        <section className="space-y-4 rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-black/30 p-1">
            {(["HAND", "FOOT"] as Part[]).map((p) => (
              <button key={p} type="button" onClick={() => setPart(p)} className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${part === p ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}>
                {p === "HAND" ? tr("Móng tay", "Hands") : tr("Móng chân", "Feet")}
              </button>
            ))}
          </div>

          <Chips title={tr("Khách đi dịp gì? (không bắt buộc)", "Occasion (optional)")} items={OCCASIONS} value={prefs.occasion ?? null} onChange={(v) => setPrefs((p) => ({ ...p, occasion: v }))} />
          {part === "HAND" && <Chips title={tr("Độ dài khách muốn", "Preferred length")} items={LENGTHS} value={prefs.length ?? null} onChange={(v) => setPrefs((p) => ({ ...p, length: v }))} />}
          <Chips title={tr("Phong cách", "Style")} items={VIBES} value={prefs.vibe ?? null} onChange={(v) => setPrefs((p) => ({ ...p, vibe: v }))} />

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-emerald-500/[0.06] p-3.5 ring-1 ring-emerald-500/20">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-emerald-500" />
            <span className="text-sm text-slate-200">
              <b>{tr("Khách đồng ý cho chụp tay", "Client agrees to a hand photo")}</b>
              <span className="mt-0.5 block text-xs text-slate-400">{tr("Ảnh chỉ dùng để phân tích rồi bỏ ngay — PawNail không lưu ảnh tay khách.", "The photo is analysed and discarded — PawNail never stores client hand photos.")}</span>
            </span>
          </label>

          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) analyse(f); }} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) analyse(f); }} />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <button type="button" onClick={() => (consent ? camRef.current?.click() : needConsent())} className="flex min-h-[56px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-base font-black text-white shadow-lg shadow-pink-600/25 active:scale-[0.99]">
              <Camera className="h-5 w-5" />{part === "HAND" ? tr("Chụp tay khách", "Photograph the hand") : tr("Chụp chân khách", "Photograph the feet")}
            </button>
            <button type="button" onClick={() => (consent ? fileRef.current?.click() : needConsent())} className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-5 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10">
              <ImagePlus className="h-4 w-4" />{tr("Chọn ảnh có sẵn", "Choose a photo")}
            </button>
          </div>
          <ul className="grid gap-1.5 text-xs text-slate-400 sm:grid-cols-3">
            <li className="flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />{part === "HAND" ? tr("Chụp mu bàn tay, đủ 5 ngón", "Back of the hand, all 5 fingers") : tr("Chụp từ trên xuống, đủ các ngón", "From above, all toes in frame")}</li>
            <li className="flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />{tr("Ánh sáng trắng, không đèn màu", "White light, no coloured lamps")}</li>
            <li className="flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />{tr("Giữ máy cách tay ~25 cm", "Hold the phone ~25 cm away")}</li>
          </ul>
          <button type="button" onClick={() => manual()} className="w-full text-center text-xs font-bold text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline">
            {tr("Không chụp — tự chọn tình trạng để xem gợi ý", "No photo — pick the condition yourself")}
          </button>
        </section>
      )}

      {phase === "loading" && (
        <section className="flex flex-col items-center gap-4 rounded-3xl bg-white/[0.03] p-8 ring-1 ring-white/10" aria-live="polite">
          {preview ? (
            <div className="relative h-56 w-56 overflow-hidden rounded-3xl ring-1 ring-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="h-full w-full object-cover" />
              <div className="pn-scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-pink-400/40 to-transparent" />
            </div>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
          )}
          <p className="text-sm font-bold text-white">{preview ? tr("Đang soi tay khách…", "Analysing the hand…") : tr("Đang chuẩn bị gợi ý…", "Preparing suggestions…")}</p>
          {preview && <p className="text-xs text-slate-500">{tr("Thường mất 3–8 giây", "Usually 3–8 seconds")}</p>}
        </section>
      )}

      {phase === "result" && result && (
        <ResultView
          r={result}
          preview={preview}
          editing={editing}
          refreshing={refreshing}
          onEdit={() => setEditing((v) => !v)}
          onChange={update}
          onReset={reset}
          onOpen={setOpen}
          userId={user.id}
        />
      )}

      {open && (
        <DesignSheet
          d={open}
          onClose={() => setOpen(null)}
          onSaved={(saved, saves) => setResult((cur) => (cur ? { ...cur, designs: cur.designs.map((x) => (x.id === open.id ? { ...x, saved, saves } : x)) } : cur))}
        />
      )}
    </div>
  );
}

function Chips<T extends string>({ title, items, value, onChange }: { title: string; items: { id: T; label: L }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button key={it.id} type="button" aria-pressed={value === it.id} onClick={() => onChange(value === it.id ? null : it.id)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${value === it.id ? "bg-white text-slate-900" : "bg-white/[0.05] text-slate-300 ring-1 ring-white/10 hover:bg-white/10"}`}>
            {t(it.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon, right, children }: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">{icon}{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function ResultView({ r, preview, editing, refreshing, onEdit, onChange, onReset, onOpen, userId }: {
  r: Result; preview: string | null; editing: boolean; refreshing: boolean; onEdit: () => void; onChange: (p: Partial<Perception>) => void; onReset: () => void; onOpen: (d: Design) => void; userId: string;
}) {
  useTr();
  const p = r.perception;
  const a = r.advice;
  const issues = a.conditions.filter((c) => !CONDITIONS[c].redFlag);
  const partConds = useMemo(() => CONDITION_IDS.filter((c) => CONDITIONS[c].part === "BOTH" || CONDITIONS[c].part === p.part), [p.part]);
  const toggle = (c: string) => onChange({ conditions: p.conditions.includes(c) ? p.conditions.filter((x) => x !== c) : [...p.conditions, c] });

  return (
    <div className="space-y-4">
      {/* Tóm tắt */}
      <section className="rounded-3xl bg-gradient-to-br from-pink-500/10 via-fuchsia-500/5 to-transparent p-5 ring-1 ring-white/10">
        <div className="flex gap-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={tr("Ảnh tay khách", "Client's hand")} className="h-24 w-24 flex-shrink-0 rounded-2xl object-cover ring-1 ring-white/15 sm:h-28 sm:w-28" />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            {r.note && <p className="text-sm leading-relaxed text-slate-200">{tr(r.note, r.noteEn || r.note)}</p>}
            <div className="flex flex-wrap gap-1.5">
              {[LABELS.skinTone[p.skinTone], LABELS.undertone[p.undertone], LABELS.nailLength[p.nailLength], ...(p.part === "HAND" ? [LABELS.fingerLength[p.fingerLength], LABELS.bedWidth[p.bedWidth]] : [])].map((l) => (
                <span key={l[0]} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-slate-200">{t(l)}</span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button type="button" onClick={onEdit} aria-pressed={editing} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ring-1 ${editing ? "bg-white text-slate-900 ring-white" : "bg-white/[0.06] text-white ring-white/10 hover:bg-white/10"}`}>
                <Pencil className="h-3.5 w-3.5" />{editing ? tr("Xong", "Done") : tr("Sửa kết quả", "Adjust")}
              </button>
              <span className="text-[11px] text-slate-500">
                {r.provider === "manual" ? tr("Thợ tự chọn", "Set by the tech") : tr("AI nhận diện — thợ kiểm tra lại", "AI-detected — please double-check")}
              </span>
            </div>
          </div>
        </div>

        {editing && (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <EditRow label={tr("Màu da", "Skin tone")} list={SKIN_TONES} labels={LABELS.skinTone} value={p.skinTone} onPick={(v) => onChange({ skinTone: v })} />
            <EditRow label={tr("Tông da", "Undertone")} list={UNDERTONES} labels={LABELS.undertone} value={p.undertone} onPick={(v) => onChange({ undertone: v })} />
            <EditRow label={tr("Độ dài móng", "Nail length")} list={NAIL_LENGTHS} labels={LABELS.nailLength} value={p.nailLength} onPick={(v) => onChange({ nailLength: v })} />
            {p.part === "HAND" && <EditRow label={tr("Ngón tay", "Fingers")} list={FINGER_LENGTHS} labels={LABELS.fingerLength} value={p.fingerLength} onPick={(v) => onChange({ fingerLength: v })} />}
            {p.part === "HAND" && <EditRow label={tr("Lòng móng", "Nail beds")} list={BED_WIDTHS} labels={LABELS.bedWidth} value={p.bedWidth} onPick={(v) => onChange({ bedWidth: v })} />}
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={p.hasProduct} onChange={(e) => onChange({ hasProduct: e.target.checked })} className="h-4 w-4 accent-pink-500" />
              {tr("Đang có gel / bột / sơn cũ", "Has old gel / acrylic / polish")}
            </label>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Tình trạng (bấm để bật / tắt)", "Conditions (tap to toggle)")}</p>
              <div className="flex flex-wrap gap-1.5">
                {partConds.map((c) => {
                  const on = p.conditions.includes(c);
                  const red = CONDITIONS[c].redFlag;
                  return (
                    <button key={c} type="button" aria-pressed={on} onClick={() => toggle(c)} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-colors ${on ? (red ? "bg-rose-500 text-white ring-rose-400" : "bg-white text-slate-900 ring-white") : red ? "bg-rose-500/[0.06] text-rose-200 ring-rose-500/25 hover:bg-rose-500/15" : "bg-white/[0.04] text-slate-300 ring-white/10 hover:bg-white/10"}`}>
                      {t(CONDITIONS[c].label)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Cảnh báo phải ngừng */}
      {a.redFlags.length > 0 && (
        <section role="alert" className="space-y-2 rounded-3xl bg-rose-500/10 p-5 ring-1 ring-rose-500/40">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-rose-200"><AlertTriangle className="h-4 w-4" />{tr("Cần dừng lại", "Stop and check")}</h2>
          {a.redFlags.map((c) => (
            <div key={c} className="rounded-2xl bg-black/20 p-3.5">
              <p className="text-sm font-black text-white">{t(CONDITIONS[c].label)}</p>
              <p className="mt-0.5 text-xs text-rose-100/80">{t(CONDITIONS[c].what)}</p>
              <p className="mt-1.5 text-sm text-rose-50">{t(CONDITIONS[c].todo)}</p>
            </div>
          ))}
          <p className="text-[11px] text-rose-200/70">{tr("Thợ nail không chẩn đoán bệnh — đây là dấu hiệu nên để bác sĩ xem.", "Nail techs don't diagnose — these are signs a doctor should check.")}</p>
        </section>
      )}

      {/* Tình trạng */}
      <Section title={p.part === "FOOT" ? tr("Tình trạng chân", "Foot condition") : tr("Tình trạng tay", "Hand condition")} icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-3.5 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />{a.redFlags.length ? tr("Ngoài các điểm cần dừng ở trên, móng và da còn lại ổn.", "Apart from the points above, the rest looks healthy.") : tr("Móng và da khoẻ — làm được hầu hết các kiểu.", "Healthy nails and skin — most styles will work.")}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {issues.map((c) => (
              <div key={c} className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/10">
                <p className="text-sm font-black text-white">{t(CONDITIONS[c].label)}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{t(CONDITIONS[c].what)}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Hợp với khách */}
      <Section title={tr("Hợp với khách", "Best for this client")} icon={<Sparkles className="h-4 w-4 text-pink-300" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Dáng móng", "Nail shape")}</p>
            {a.shapes.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-white/10">
                <ShapeIcon id={s.id} className={`h-10 w-7 flex-shrink-0 ${i === 0 ? "text-pink-300" : "text-slate-300"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{t(LABELS.shape[s.id])}{i === 0 && <span className="ml-1.5 rounded-full bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-black text-pink-200">{tr("Hợp nhất", "Best")}</span>}</p>
                  <p className="text-xs text-slate-400">{t(s.why)}</p>
                </div>
              </div>
            ))}
            {a.avoidShapes.length > 0 && <p className="text-xs text-slate-500">{tr("Nên tránh: ", "Avoid: ")}{a.avoidShapes.map((s) => t(LABELS.shape[s])).join(", ")}</p>}
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Màu hợp da", "Flattering colours")}</p>
              <div className="grid grid-cols-4 gap-2">
                {a.palette.map((s) => (
                  <div key={s.hex} className="text-center">
                    <span className="mx-auto block h-10 w-10 rounded-full shadow-inner ring-2 ring-white/15" style={{ background: s.hex }} />
                    <span className="mt-1 block text-[10px] leading-tight text-slate-300">{t(s.name)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Độ dài", "Length")}</p>
              <p className="text-sm font-semibold text-white">{t(a.length)}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Kỹ thuật nên dùng", "Recommended technique")}</p>
              <p className="text-sm font-black text-white">{a.technique.id}</p>
              <p className="text-xs text-slate-400">{t(a.technique.why)}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Quy trình */}
      <Section title={tr("Quy trình đề xuất", "Service plan")} icon={<Clock className="h-4 w-4 text-sky-300" />} right={<span className="text-xs font-bold text-slate-300">~{a.totalMinutes} {tr("phút", "min")}</span>}>
        <ol className="space-y-2">
          {a.steps.map((s, i) => (
            <li key={i} className={`flex gap-3 rounded-2xl p-3 ${s.flag ? "bg-rose-500/10 ring-1 ring-rose-500/30" : "bg-white/[0.02]"}`}>
              <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black ${s.flag ? "bg-rose-500 text-white" : "bg-sky-500/15 text-sky-300"}`}>{s.flag ? "!" : i + 1 - a.steps.filter((x, k) => x.flag && k < i).length}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2 text-sm font-bold text-white">{t(s.title)}{s.minutes > 0 && <span className="flex-shrink-0 text-[11px] font-semibold text-slate-500">{s.minutes}′</span>}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t(s.detail)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Menu của thợ */}
      {r.menu.length > 0 && (
        <Section title={tr("Từ menu của bạn", "From your menu")} icon={<BookOpen className="h-4 w-4 text-amber-300" />} right={refreshing ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : undefined}>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {r.menu.map((it) => (
              <div key={it.id} className="w-36 flex-shrink-0 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
                <div className="aspect-square bg-slate-900">
                  {it.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cdnImage(it.images[0], 300)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-500/20 to-fuchsia-500/5 text-xs font-black uppercase text-pink-100/80">{it.technique || "PawNail"}</div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-bold text-white">{it.name}</p>
                  <p className="text-sm font-black text-emerald-300">{priceLabel(it.priceFrom, it.priceTo)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {r.menuTotal === 0 && (
        <Link href={`/profile/${userId}?tab=menu`} className="flex items-center gap-3 rounded-3xl bg-amber-500/[0.07] p-4 ring-1 ring-amber-400/20 hover:bg-amber-500/10">
          <BookOpen className="h-5 w-5 flex-shrink-0 text-amber-300" />
          <span className="text-sm text-amber-50">{tr("Tạo menu mẫu có giá — lần sau app gợi ý luôn mẫu CỦA BẠN hợp với tay khách.", "Build your priced menu — next time the app suggests YOUR designs that suit the client.")}</span>
        </Link>
      )}

      {/* Mẫu PawNail */}
      <Section title={tr("Mẫu hợp với tay khách", "Designs that suit this client")} icon={<Sparkles className="h-4 w-4 text-fuchsia-300" />} right={refreshing ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : undefined}>
        {r.designs.length === 0 ? (
          <p className="text-sm text-slate-400">{tr("Chưa có mẫu phù hợp trong kho — thử đổi phong cách hoặc dịp.", "No matching designs yet — try another style or occasion.")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {r.designs.map((d) => <DesignCard key={d.id} d={d} onOpen={() => onOpen(d)} />)}
          </div>
        )}
      </Section>

      {/* Dặn khách */}
      <Section title={tr("Dặn khách", "Aftercare for the client")} icon={<Hand className="h-4 w-4 text-rose-300" />}>
        <ul className="space-y-1.5">
          {a.care.map((c, i) => <li key={i} className="flex gap-2 text-sm text-slate-200"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />{t(c)}</li>)}
        </ul>
      </Section>

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onReset} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white shadow-lg shadow-pink-600/20">
          <RotateCcw className="h-4 w-4" />{tr("Soi khách khác", "Next client")}
        </button>
        <Link href={`/profile/${userId}?tab=menu`} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10">
          <BookOpen className="h-4 w-4" />{tr("Mở menu của tôi", "Open my menu")}
        </Link>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500"><ShieldCheck className="h-3 w-3" />{tr("Ảnh tay khách không được lưu. Kết quả chỉ mang tính tham khảo cho thợ.", "Client photos are not stored. Results are guidance for the technician.")}</p>
    </div>
  );
}

function EditRow<T extends string>({ label, list, labels, value, onPick }: { label: string; list: readonly T[]; labels: Record<T, L>; value: T; onPick: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map((v) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${value === v ? "bg-white text-slate-900" : "bg-white/[0.05] text-slate-300 ring-1 ring-white/10 hover:bg-white/10"}`}>
            {t(labels[v])}
          </button>
        ))}
      </div>
    </div>
  );
}
