"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardPaste, Loader2, Store } from "lucide-react";

interface Preview { isHiring: boolean; phoneDisplay: string | null; salonName: string | null; address: string | null; city: string | null; state: string | null; zip: string | null; salaryAmount: string; salaryType: string; skills: string[]; benefits: string[]; isUrgent: boolean; title: string; market: string | null }
interface Req { id: string; kind: string; name: string; contact: string; note: string | null; userId: string | null; createdAt: string; job: { id: string; salonName: string; city: string; state: string; phone: string } }

// Admin → Studio: "Đăng hộ tiệm" (dán bài → xem trước → đăng) + yêu cầu Nhận tin / Gỡ tin.
export default function PostForSalons() {
  const [text, setText] = useState("");
  const [src, setSrc] = useState("");
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ requests: Req[]; active: number; expired: number } | null>(null);
  const load = useCallback(() => { fetch("/api/admin/ingest").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const call = (body: object) => fetch("/api/admin/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));
  const preview = async () => { if (!text.trim()) return; setBusy(true); const { j } = await call({ action: "preview", text }); setPv(j); setBusy(false); };
  const post = async () => {
    setBusy(true);
    const { ok, j } = await call({ action: "post", posts: [{ text, sourceUrl: src || undefined }] });
    setBusy(false);
    const r = j.results?.[0];
    if (!ok || !r) { toast.error(j.error || "Đăng chưa được."); return; }
    if (r.status === "skipped") { toast.error(`Bỏ qua: ${r.reason}`); return; }
    toast.success(r.status === "created" ? "Đã đăng hộ tiệm" : "Tin đã có — đã làm mới");
    setText(""); setSrc(""); setPv(null); load();
  };
  const resolve = async (id: string, decision: string) => {
    const { ok, j } = await call({ action: "resolve", requestId: id, decision });
    if (!ok) { toast.error(j.error || "Chưa xử lý được."); return; }
    toast.success(decision === "remove" ? "Đã gỡ tin & chặn đăng lại số này" : decision === "claim" ? "Đã chuyển tin cho chủ tiệm" : "Đã đóng yêu cầu");
    load();
  };
  const field = (k: string, v: string | null | undefined) => (
    <div className="flex gap-2 text-xs"><span className="w-20 shrink-0 text-slate-500">{k}</span><span className={v ? "text-slate-100" : "text-red-300"}>{v || "— không tìm thấy"}</span></div>
  );

  return (
    <section className="glass-card space-y-4 rounded-2xl p-4" data-testid="post-for-salons">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-black text-white"><Store className="h-4 w-4 text-pink-300" /> Đăng hộ tiệm</h2>
        <p className="mt-1 text-xs text-slate-400">
          Tin tiệm nhờ đăng — dán nguyên bài, hệ thống tự tách SĐT / tên tiệm / địa chỉ / bang / lương. Tin hiện nhãn “Đăng hộ tiệm”, chỉ gọi trực tiếp, tự ẩn sau 14 ngày.
          {data && ` Đang hiện: ${data.active} tin · hết hạn: ${data.expired}.`}
        </p>
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setPv(null); }} rows={5} placeholder="Dán bài tuyển thợ của tiệm…" className="input-field text-sm" data-testid="ingest-text" />
      <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Link bài gốc (không bắt buộc, chỉ admin thấy)" className="input-field text-sm" />
      <div className="flex gap-2">
        <button type="button" onClick={preview} disabled={busy || !text.trim()} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-white/10 disabled:opacity-50"><ClipboardPaste className="h-4 w-4" /> Xem trước</button>
        <button type="button" onClick={post} disabled={busy || !pv || !pv.phoneDisplay || !pv.state} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 text-sm font-black text-white disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Đăng hộ</button>
      </div>
      {pv && (
        <div className="space-y-1 rounded-xl bg-slate-950/60 p-3 ring-1 ring-white/10" data-testid="ingest-preview">
          {!pv.isHiring && <p className="pb-1 text-xs font-bold text-amber-300">⚠ Có vẻ không phải bài tuyển thợ</p>}
          {field("Tiêu đề", pv.title)}
          {field("SĐT", pv.phoneDisplay)}
          {field("Tên tiệm", pv.salonName)}
          {field("Địa chỉ", pv.address)}
          {field("Khu vực", [pv.city, pv.state, pv.zip].filter(Boolean).join(", "))}
          {field("Lương", `${pv.salaryAmount} · ${pv.salaryType}`)}
          {field("Kỹ năng", pv.skills.join(", "))}
          {field("Quyền lợi", pv.benefits.join(", "))}
        </div>
      )}

      {data && data.requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300">Yêu cầu từ tiệm ({data.requests.length})</p>
          {data.requests.map((r) => (
            <div key={r.id} className="space-y-2 rounded-xl bg-slate-950/60 p-3 text-xs ring-1 ring-white/10">
              <p className="text-slate-200"><b className={r.kind === "remove" ? "text-red-300" : "text-sky-300"}>{r.kind === "remove" ? "GỠ TIN" : "NHẬN TIN"}</b> · {r.job.salonName} ({r.job.city}, {r.job.state}) · SĐT tin: {r.job.phone}</p>
              <p className="text-slate-400">Người gửi: {r.name} · {r.contact}{r.userId ? " · đã đăng nhập" : ""}{r.note ? ` · “${r.note}”` : ""}</p>
              <div className="flex flex-wrap gap-2">
                {r.kind === "remove" && <button type="button" onClick={() => resolve(r.id, "remove")} className="min-h-[36px] rounded-lg bg-red-600/80 px-3 font-bold text-white">Gỡ tin & không đăng lại</button>}
                {r.kind === "claim" && <button type="button" onClick={() => resolve(r.id, "claim")} className="min-h-[36px] rounded-lg bg-sky-600/80 px-3 font-bold text-white">Chuyển tin cho người này</button>}
                <a href={`/jobs/${r.job.id}`} target="_blank" className="flex min-h-[36px] items-center rounded-lg bg-white/[0.06] px-3 font-bold text-slate-200">Xem tin</a>
                <button type="button" onClick={() => resolve(r.id, "dismiss")} className="min-h-[36px] rounded-lg px-3 font-bold text-slate-400">Bỏ qua</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
