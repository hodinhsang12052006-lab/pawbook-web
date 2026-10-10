"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Sparkles, Trash2, Wand2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { AiBadge, DesignVisual, occasionLabel, type Design } from "@/components/designs/DesignViews";
import { valueLabel } from "@/lib/i18n/valueLabel";

interface State { enabled: boolean; storage?: boolean; textOnly?: boolean; cfImages?: number; imagesToday?: number; nextOccasion?: { id: string; title: string; emoji: string } | null; dailyLimit: number; madeToday: number; drafts: Design[]; published: Design[]; needsSql?: boolean }

// Phòng nội dung → "Mẫu nail AI": tạo mẫu bằng Gemini, DUYỆT trước khi người
// dùng thấy (AI hay vẽ sai ngón tay / mô tả lệch — admin là người chốt).
export default function AdminDesigns() {
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/designs")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSt)
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const generate = async (mode: "engine" | "ai") => {
    setBusy(true);
    const id = toast.loading(mode === "engine" ? "Máy PawNail đang ghép mẫu…" : "Gemini đang nghĩ mẫu… (10–40 giây)");
    try {
      const res = await fetch("/api/admin/designs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 3, mode }) });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || "Không tạo được.");
      if (r.created?.length) toast.success(`Đã tạo ${r.created.length} mẫu nháp — duyệt bên dưới.`, { id });
      else toast.error(r.errors?.[0] || "Không tạo được mẫu nào.", { id });
      if (r.errors?.length && r.created?.length) toast(`${r.errors.length} mẫu lỗi: ${r.errors[0]}`, { icon: "⚠️" });
      load();
    } catch (err) {
      toast.error((err as Error).message, { id });
    } finally {
      setBusy(false);
    }
  };

  const makeOccasion = async () => {
    const o = st?.nextOccasion;
    if (!o || !confirm(`Tạo bộ 50 mẫu ${o.title} ${o.emoji}? Ảnh thật sẽ được vẽ dần (miễn phí) trong các lượt sau.`)) return;
    setBusy(true);
    const id = toast.loading(`Đang tạo bộ mẫu ${o.title}…`);
    const res = await fetch("/api/admin/designs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "occasion", occasion: o.id, count: 50 }) });
    const r = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(r.error || "Không tạo được.", { id });
    toast.success(`Đã tạo ${r.created?.length ?? 0} mẫu ${o.title} — ảnh đang được vẽ dần.`, { id });
    load();
  };

  const approveAllWithImages = async () => {
    const ids = (st?.drafts ?? []).filter((d) => d.imageUrl).map((d) => d.id);
    if (!ids.length || !confirm(`Duyệt & đăng ${ids.length} mẫu đã có ảnh? Hãy xem qua ảnh trước — mẫu ảnh lỗi nên bấm "Bỏ".`)) return;
    const res = await fetch("/api/admin/designs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, status: "published" }) });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(r.error || "Không duyệt được.");
    toast.success(`Đã đăng ${r.count} mẫu.`);
    load();
  };

  const redraw = async (d: Design) => {
    setActing(d.id);
    const id = toast.loading("Đang vẽ lại ảnh… (5–20 giây)");
    const res = await fetch("/api/admin/designs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, action: "redraw" }) });
    const r = await res.json().catch(() => ({}));
    setActing(null);
    if (!res.ok) return toast.error(r.error || "Không vẽ lại được.", { id });
    toast.success(`Đã vẽ lại (lần ${r.redraws}/3).`, { id });
    load();
  };

  const setStatus = async (d: Design, status: "published" | "rejected") => {
    setActing(d.id);
    const res = await fetch("/api/admin/designs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, status }) });
    setActing(null);
    if (!res.ok) return toast.error("Không cập nhật được.");
    toast.success(status === "published" ? "Đã đăng — người dùng thấy ngay." : "Đã bỏ mẫu.");
    load();
  };

  return (
    <section id="mau-ai" aria-label="Mẫu nail mới" className="scroll-mt-24 space-y-4 rounded-2xl border border-pink-500/25 bg-pink-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-white"><Wand2 className="h-5 w-5 text-pink-300" /> Mẫu nail mới mỗi ngày</h2>
          <p className="text-xs text-slate-400">
            Máy tạo mẫu PawNail ghép mẫu theo dịp lễ + hashtag đang lên: vật tư, các bước, thời gian, giá gợi ý — không tốn phí AI. Mỗi sáng tự tạo 4 mẫu; duyệt xong mới hiện ở /designs và bảng tin.
            {st && ` Hôm nay đã tạo ${st.madeToday} mẫu.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => generate("engine")} disabled={busy} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 text-sm font-black text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Tạo 3 mẫu PawNail (miễn phí)
          </button>
          {st?.nextOccasion && (
            <button type="button" onClick={makeOccasion} disabled={busy} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-orange-500/15 px-4 text-sm font-black text-orange-200 ring-1 ring-orange-400/40 disabled:opacity-50">
              {st.nextOccasion.emoji} Tạo bộ 50 mẫu {st.nextOccasion.title}
            </button>
          )}
          <button type="button" onClick={() => generate("ai")} disabled={busy || !st?.enabled} title={st?.enabled ? undefined : "Chưa bật Gemini (tuỳ chọn)"} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-white/15 disabled:opacity-50">
            <Wand2 className="h-4 w-4 text-pink-300" /> Tạo bằng Gemini
          </button>
        </div>
      </div>
      {st && (st.cfImages ? (
        <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 ring-1 ring-emerald-500/25">Ảnh thật: Cloudflare Workers AI (gói miễn phí) — tối đa {st.cfImages} ảnh/ngày, hết lượt thì dùng hình minh hoạ, không tốn tiền.</p>
      ) : (
        <p className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-slate-400 ring-1 ring-white/10">Ảnh thật (tuỳ chọn, miễn phí): thêm CF_ACCOUNT_ID + CF_AI_TOKEN của Cloudflare Workers AI vào Vercel. Chưa có thì mẫu dùng hình minh hoạ app tự vẽ.</p>
      ))}
      {st && st.enabled && (st.textOnly || st.storage === false) && <p className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-200 ring-1 ring-sky-500/25">Chế độ chỉ viết chữ (Gemini miễn phí): AI viết ý tưởng + vật tư + các bước, minh hoạ do app tự vẽ từ bảng màu. Bật ảnh AI: bỏ AI_DESIGNS_TEXT_ONLY trên Vercel sau khi gắn thanh toán Google.</p>}
      {st?.needsSql && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/25">Chưa tạo bảng — chạy prisma/sql/2026-10-09_nail_designs.sql.</p>}

      {!!st?.drafts.length && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
          <p className="text-xs text-slate-400">
            {st.drafts.length} mẫu chờ duyệt · {st.drafts.filter((d) => d.imageUrl).length} đã có ảnh{st.cfImages ? ` · hôm nay đã vẽ ${st.imagesToday ?? 0}/${st.cfImages} ảnh` : ""}
          </p>
          <button type="button" onClick={approveAllWithImages} disabled={!st.drafts.some((d) => d.imageUrl)} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-emerald-600/90 px-3 text-xs font-black text-white disabled:opacity-40">
            <Check className="h-4 w-4" /> Duyệt tất cả mẫu có ảnh
          </button>
        </div>
      )}
      {st && st.drafts.length === 0 ? (
        <p className="text-xs text-slate-500">Không có mẫu nào chờ duyệt.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {st?.drafts.map((d) => (
            <article key={d.id} aria-label={`Nháp: ${d.title}`} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
              <div className="relative aspect-square bg-slate-900">
                <DesignVisual d={d} />
                <AiBadge d={d} className="absolute left-2 top-2" />
                {!!st?.cfImages && (
                  <button type="button" disabled={acting === d.id} onClick={() => redraw(d)} className="absolute bottom-2 right-2 inline-flex min-h-[32px] items-center gap-1 rounded-full bg-black/70 px-3 text-[11px] font-bold text-white backdrop-blur disabled:opacity-50">
                    {acting === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {d.imageUrl ? "Vẽ lại ảnh" : "Vẽ ảnh"}
                  </button>
                )}
              </div>
              <div className="space-y-1.5 p-3">
                {d.occasion && <p className="text-[10px] font-black uppercase tracking-wider text-pink-300">{occasionLabel(d.occasion)}</p>}
                <p className="text-sm font-bold text-white">{d.title}</p>
                <p className="text-[11px] text-slate-500">{d.titleEn}</p>
                <p className="text-xs text-slate-400">{d.description}</p>
                <p className="text-[11px] text-slate-500">
                  {[...d.skills.map(valueLabel), `${d.minutes} phút`, d.priceHint, `${d.materials.length} vật tư`, `${d.steps.length} bước`].filter(Boolean).join(" · ")}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button type="button" disabled={acting === d.id} onClick={() => setStatus(d, "published")} className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-black text-white disabled:opacity-50">
                    <Check className="h-4 w-4" /> Duyệt & đăng
                  </button>
                  <button type="button" disabled={acting === d.id} onClick={() => setStatus(d, "rejected")} className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] text-xs font-bold text-slate-300 ring-1 ring-white/10 disabled:opacity-50">
                    <Trash2 className="h-4 w-4" /> Bỏ
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!!st?.published.length && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Đã đăng gần đây</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {st.published.map((d) => (
              <div key={d.id} className="w-28 flex-shrink-0">
                <div className="aspect-square w-full overflow-hidden rounded-lg"><DesignVisual d={d} /></div>
                <p className="mt-1 truncate text-[11px] text-slate-300">{d.title}</p>
                <p className="text-[10px] text-slate-500">🔖 {d.saves} lượt lưu</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
