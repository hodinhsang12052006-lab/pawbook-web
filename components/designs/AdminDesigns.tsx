"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import { AiBadge, occasionLabel, type Design } from "@/components/designs/DesignViews";
import { valueLabel } from "@/lib/i18n/valueLabel";

interface State { enabled: boolean; storage?: boolean; dailyLimit: number; madeToday: number; drafts: Design[]; published: Design[]; needsSql?: boolean }

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

  const generate = async () => {
    setBusy(true);
    const id = toast.loading("Gemini đang nghĩ mẫu và vẽ ảnh… (20–40 giây)");
    try {
      const res = await fetch("/api/admin/designs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 3 }) });
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

  const setStatus = async (d: Design, status: "published" | "rejected") => {
    setActing(d.id);
    const res = await fetch("/api/admin/designs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, status }) });
    setActing(null);
    if (!res.ok) return toast.error("Không cập nhật được.");
    toast.success(status === "published" ? "Đã đăng — người dùng thấy ngay." : "Đã bỏ mẫu.");
    load();
  };

  return (
    <section id="mau-ai" aria-label="Mẫu nail AI" className="scroll-mt-24 space-y-4 rounded-2xl border border-pink-500/25 bg-pink-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-white"><Wand2 className="h-5 w-5 text-pink-300" /> Mẫu nail AI</h2>
          <p className="text-xs text-slate-400">
            Gemini viết mẫu theo dịp lễ + xu hướng thật, vẽ ảnh minh hoạ. Mỗi sáng tự tạo; duyệt xong mới hiện ở /designs và bảng tin.
            {st && ` Hôm nay: ${st.madeToday}/${st.dailyLimit} mẫu.`}
          </p>
        </div>
        <button type="button" onClick={generate} disabled={busy || !st?.enabled || st?.storage === false} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 text-sm font-black text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Tạo 3 mẫu mới
        </button>
      </div>
      {st && !st.enabled && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/25">Chưa có GEMINI_API_KEY trên máy chủ — thêm vào Vercel rồi deploy lại.</p>}
      {st && st.enabled && st.storage === false && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/25">Chưa có Cloudinary để lưu ảnh — thêm CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET vào Vercel rồi deploy lại.</p>}
      {st?.needsSql && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/25">Chưa tạo bảng — chạy prisma/sql/2026-10-09_nail_designs.sql.</p>}

      {st && st.drafts.length === 0 ? (
        <p className="text-xs text-slate-500">Không có mẫu nào chờ duyệt.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {st?.drafts.map((d) => (
            <article key={d.id} aria-label={`Nháp: ${d.title}`} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
              <div className="relative aspect-square bg-slate-900">
                {d.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt={d.title} className="h-full w-full object-cover" />
                )}
                <AiBadge className="absolute left-2 top-2" />
              </div>
              <div className="space-y-1.5 p-3">
                {d.occasion && <p className="text-[10px] font-black uppercase tracking-wider text-pink-300">{occasionLabel(d.occasion)}</p>}
                <p className="text-sm font-bold text-white">{d.title}</p>
                <p className="text-[11px] text-slate-500">{d.titleEn}</p>
                <p className="text-xs text-slate-400">{d.description}</p>
                <p className="text-[11px] text-slate-500">
                  {d.skills.map(valueLabel).join(" · ")} · {d.minutes} phút · {d.priceHint} · {d.materials.length} vật tư · {d.steps.length} bước
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
                {d.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt={d.title} className="aspect-square w-full rounded-lg object-cover" />
                )}
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
