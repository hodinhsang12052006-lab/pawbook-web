"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardPaste, Globe, Loader2, Store } from "lucide-react";
import { timeAgo } from "@/lib/feedFormat";

interface Final { title: string; salonName: string; phone: string; market: "US" | "AU"; state: string; city: string; salaryAmount: string; salaryType: string; skills: string[]; benefits: string[]; address: string | null }
interface DryRun { isHiring: boolean; discriminatory?: boolean; decision: "created" | "bumped" | "updated" | "skipped"; reason?: string | null; final?: Final; phoneDisplay: string | null; salonName: string | null; city: string | null; state: string | null; salaryAmount: string; salaryType: string }
interface Req { id: string; kind: string; name: string; contact: string; note: string | null; userId: string | null; createdAt: string; job: { id: string; salonName: string; city: string; state: string; phone: string } }
interface ProviderRun { flag: boolean; keys: boolean; licensed?: boolean; status: string; calls?: number; httpStatus?: number | null; active?: Record<string, number>; hidden?: Record<string, number>; lastSuccessAt?: string | null; alert?: string | null; markets?: Record<string, { fetched: number; dropped?: number; created: number; providerCount: number | null }> }
interface External {
  flags: { adzuna: { flag: boolean; keys: boolean; licensed?: boolean; public?: boolean }; careerjet: { flag: boolean; keys: boolean; terms?: boolean; enabled?: boolean }; referralFee?: boolean };
  last: { at: string; adzuna: ProviderRun } | null;
  live: { active: Record<string, number>; hidden: Record<string, number>; expired: number } | null;
}
interface Data { requests: Req[]; active: number; hiddenByFilter: number; expired: number; ingestAccepting?: boolean; lastIngestAt: string | null; lastIngestEstimated?: boolean; lastBatchAt: string | null; ingestStale: boolean; ingestRejectedOnly?: boolean; staleHours: number; external: External | null }

const DECISION: Record<string, string> = { created: "Sẽ tạo tin mới", bumped: "Tiệm đã có tin → sẽ đẩy tin lên đầu (đăng lại)", updated: "Trùng đúng bài cũ → sẽ cập nhật", skipped: "Sẽ BỎ QUA" };

// Admin → Studio: "Đăng hộ tiệm" (tiệm NHỜ đăng: dán bài → xem trước quyết định thật → sửa tay → ghi người yêu cầu → đăng)
// + yêu cầu Nhận tin / Gỡ tin + nhịp tim nguồn tin tổng hợp + trạng thái nguồn đối tác (Adzuna / Careerjet).
export default function PostForSalons() {
  const [text, setText] = useState("");
  const [src, setSrc] = useState("");
  const [pv, setPv] = useState<DryRun | null>(null);
  const [ov, setOv] = useState<{ salonName: string; city: string; state: string; market: string; salary: string; phone: string }>({ salonName: "", city: "", state: "", market: "", salary: "", phone: "" });
  const [who, setWho] = useState({ name: "", contact: "", requestedAt: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(() => { fetch("/api/admin/ingest").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const call = (body: object) => fetch("/api/admin/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));
  const dryrun = async (withOv: typeof ov | null) => {
    if (!text.trim()) return;
    setBusy(true);
    const { j } = await call({ action: "dryrun", text, overrides: withOv ?? undefined });
    setBusy(false);
    setPv(j);
    const f: Final | undefined = j.final;
    if (f && !withOv) setOv({ salonName: f.salonName || "", city: f.city || "", state: f.state || "", market: f.market || "", salary: f.salaryAmount !== "Thỏa thuận" ? f.salaryAmount : "", phone: f.phone || "" });
  };
  const post = async () => {
    setBusy(true);
    const { ok, j } = await call({ action: "post", posts: [{ text, sourceUrl: src || undefined, ...ov }], requester: { ...who, requestedAt: who.requestedAt ? new Date(who.requestedAt).toISOString() : undefined } });
    setBusy(false);
    const r = j.results?.[0];
    if (!ok || !r) { toast.error(j.error || "Đăng chưa được."); return; }
    if (r.status === "skipped") { toast.error(`Bỏ qua: ${r.reason}`); return; }
    toast.success(r.status === "created" ? "Đã đăng hộ tiệm" : "Tin đã có — đã làm mới");
    setText(""); setSrc(""); setPv(null); setWho({ name: "", contact: "", requestedAt: new Date().toISOString().slice(0, 10) }); load();
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
  const edit = (k: keyof typeof ov, label: string, ph = "") => (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <input value={ov[k]} onChange={(e) => setOv((o) => ({ ...o, [k]: e.target.value }))} placeholder={ph} className="input-field !py-1.5 text-xs" data-testid={`ov-${k}`} />
    </label>
  );
  const stale = !!data?.ingestStale;
  const canPost = !!pv && pv.decision !== "skipped" && who.name.trim().length > 1 && who.contact.trim().length >= 6;
  const ext = data?.external;

  return (
    <section className="glass-card space-y-4 rounded-2xl p-4" data-testid="post-for-salons">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-black text-white"><Store className="h-4 w-4 text-pink-300" /> Đăng hộ tiệm</h2>
        <p className="mt-1 text-xs text-slate-400">
          CHỈ dùng khi tiệm NHỜ PawNail đăng — dán nguyên bài, hệ thống tự tách SĐT / tên tiệm / địa chỉ / bang / lương; sửa tay nếu sai. Tin hiện nhãn “Đăng hộ tiệm”, chỉ gọi trực tiếp, tự ẩn sau 14 ngày.
        </p>
        {data && (
          <p className="mt-1 text-xs text-slate-300" data-testid="ingest-stats">
            Đang hiện công khai: <b>{data.active}</b> tin (đăng hộ + từ nhóm){data.hiddenByFilter ? ` · bộ lọc chữ ẩn ${data.hiddenByFilter}` : ""} · hết hạn: {data.expired} ·{" "}
            {/* Nhịp tim bot đọc nhóm cộng đồng: quá 24 giờ không có tin mới → cảnh báo đỏ + cách xử lý bằng lời thường */}
            <span className={data.ingestAccepting === false ? "font-bold text-amber-300" : stale ? "font-bold text-red-300" : "text-emerald-300"} data-testid="ingest-heartbeat">
              tin từ nhóm nhận lần cuối: {data.lastIngestAt ? `${timeAgo(data.lastIngestAt)}${data.lastIngestEstimated ? " (theo tin mới nhất trên bảng)" : ""}` : "chưa ghi nhận"}
              {data.ingestAccepting === false
                ? " ⏸ đang tạm ngừng nhận (INGEST_AGGREGATED=off trên Vercel — xoá biến đó rồi Redeploy để nhận lại)"
                : stale
                  ? ` ⚠ quá ${data.staleHours} giờ không có tin mới — ${data.ingestRejectedOnly ? "bot vẫn gửi nhưng bài nào cũng bị loại (thử dán 1 bài ở ô dưới để xem lý do)" : "bot đọc nhóm có thể đã dừng, thường do cookie Facebook hết hạn: đăng nhập lại Facebook trong bot rồi chạy lại"}`
                  : ""}
            </span>
            {data.lastBatchAt && <span className="text-slate-500"> · lô gần nhất: {timeAgo(data.lastBatchAt)}</span>}
          </p>
        )}
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setPv(null); }} rows={5} placeholder="Dán bài tuyển thợ của tiệm…" className="input-field text-sm" data-testid="ingest-text" />
      <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Link bài gốc (không bắt buộc, chỉ admin thấy)" className="input-field text-sm" />
      <div className="flex gap-2">
        <button type="button" onClick={() => dryrun(null)} disabled={busy || !text.trim()} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-white/10 disabled:opacity-50"><ClipboardPaste className="h-4 w-4" /> Xem trước</button>
        <button type="button" onClick={post} disabled={busy || !canPost} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 text-sm font-black text-white disabled:opacity-40" data-testid="ingest-post">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Đăng hộ</button>
      </div>
      {pv && (
        <div className="space-y-2 rounded-xl bg-slate-950/60 p-3 ring-1 ring-white/10" data-testid="ingest-preview">
          <p className={`text-xs font-bold ${pv.decision === "skipped" ? "text-red-300" : "text-emerald-300"}`} data-testid="ingest-decision">
            {DECISION[pv.decision] ?? pv.decision}{pv.reason ? ` — ${pv.reason}` : ""}
          </p>
          {!pv.isHiring && pv.decision !== "skipped" && <p className="text-xs font-bold text-amber-300">⚠ Bộ tách không chắc đây là bài tuyển thợ — chỉ đăng nếu tiệm thật sự nhờ</p>}
          {pv.discriminatory && <p className="text-xs font-bold text-red-300">⚠ Có yêu cầu giới tính/tuổi — sửa trước khi đăng (khi đăng, PawNail tự gỡ cụm này khỏi nội dung).</p>}
          {pv.final ? (
            <>
              {field("Tiêu đề", pv.final.title)}
              {field("Kỹ năng", pv.final.skills.join(", "))}
              {field("Quyền lợi", pv.final.benefits.join(", "))}
              {field("Địa chỉ", pv.final.address)}
              {field("Loại lương", pv.final.salaryType)}
            </>
          ) : (
            <>
              {field("SĐT", pv.phoneDisplay)}
              {field("Tên tiệm", pv.salonName)}
              {field("Khu vực", [pv.city, pv.state].filter(Boolean).join(", "))}
              {field("Lương", `${pv.salaryAmount} · ${pv.salaryType}`)}
            </>
          )}
          <div className="space-y-1.5 border-t border-white/10 pt-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sửa tay (ghi đè bộ tách)</p>
            {edit("salonName", "Tên tiệm")}
            {edit("phone", "SĐT")}
            {edit("city", "Thành phố")}
            {edit("state", "Bang", "TX / NSW…")}
            {edit("market", "Thị trường", "US / AU")}
            {edit("salary", "Lương", "$1,200/tuần")}
            <button type="button" onClick={() => dryrun(ov)} disabled={busy} className="min-h-[36px] rounded-lg bg-white/[0.06] px-3 text-xs font-bold text-slate-200 ring-1 ring-white/10">Áp dụng & kiểm tra lại</button>
          </div>
          <div className="space-y-1.5 border-t border-white/10 pt-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">Ai của tiệm nhờ đăng? (bắt buộc)</p>
            <input value={who.name} onChange={(e) => setWho((w) => ({ ...w, name: e.target.value }))} placeholder="Tên người yêu cầu / chủ tiệm" className="input-field !py-1.5 text-xs" data-testid="req-name" />
            <input value={who.contact} onChange={(e) => setWho((w) => ({ ...w, contact: e.target.value }))} placeholder="SĐT / email / link tin nhắn của họ" className="input-field !py-1.5 text-xs" data-testid="req-contact" />
            <input type="date" value={who.requestedAt} onChange={(e) => setWho((w) => ({ ...w, requestedAt: e.target.value }))} className="input-field !py-1.5 text-xs" />
          </div>
        </div>
      )}

      {ext && (
        <div className="space-y-1 rounded-xl bg-slate-950/60 p-3 text-xs ring-1 ring-white/10" data-testid="external-status">
          <p className="flex items-center gap-2 font-bold text-slate-200"><Globe className="h-3.5 w-3.5" /> Nguồn việc đối tác</p>
          <p className="text-slate-400">
            Adzuna: {ext.flags.adzuna.flag ? "BẬT" : "tắt"} · khoá {ext.flags.adzuna.keys ? "có" : "chưa có"} · giấy phép {ext.flags.adzuna.licensed ? "có (ADZUNA_LICENSE_REF)" : "CHƯA có"}
            {ext.live ? ` · ${ext.flags.adzuna.public ? "đang hiện" : "đã lấy (chưa hiện)"} US ${ext.live.active.US ?? 0} / AU ${ext.live.active.AU ?? 0}` : " · chưa tạo bảng ExternalJob — chỉ cần khi bật Adzuna (prisma/sql/2026-11-07_external_jobs.sql)"}
            {ext.live && Object.keys(ext.live.hidden).length ? ` · ẩn: ${Object.entries(ext.live.hidden).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}
          </p>
          {ext.flags.adzuna.flag && !ext.flags.adzuna.licensed && (
            <p className="font-bold text-amber-300" data-testid="adzuna-no-license">
              Chưa có giấy phép: chỉ kiểm tra dữ liệu (độ phủ / chất lượng) — tin Adzuna KHÔNG hiện công khai. Có giấy phép thương mại thì đặt ADZUNA_LICENSE_REF.
            </p>
          )}
          {ext.last?.adzuna && (
            <p className={ext.last.adzuna.alert ? "font-bold text-red-300" : "text-slate-400"}>
              Lượt cron gần nhất: {timeAgo(ext.last.at)} · {ext.last.adzuna.status}{ext.last.adzuna.httpStatus ? ` (HTTP ${ext.last.adzuna.httpStatus})` : ""}
              {ext.last.adzuna.markets ? ` · ${Object.entries(ext.last.adzuna.markets).map(([m, v]) => `${m}: ${v.fetched} lấy về / ${v.created} mới${v.dropped ? ` / ${v.dropped} bỏ (link lạ, thiếu ngày)` : ""}${v.providerCount != null ? ` / Adzuna có ${v.providerCount}` : ""}`).join(" · ")}` : ""}
              {ext.last.adzuna.alert === "auth_error" ? " ⚠ khoá bị từ chối — kiểm tra ADZUNA_APP_ID/KEY hoặc giấy phép" : ext.last.adzuna.alert === "empty_48h" ? " ⚠ 48 giờ không có tin nào hiện được" : ext.last.adzuna.alert ? ` ⚠ ${ext.last.adzuna.alert}` : ""}
            </p>
          )}
          <p className="text-slate-400">
            Careerjet (tìm trực tiếp, không lưu): {ext.flags.careerjet.flag ? "BẬT" : "tắt"} · khoá {ext.flags.careerjet.keys ? "có" : "chưa có"} · điều khoản {ext.flags.careerjet.terms ? "đã xác nhận" : "CHƯA xác nhận bằng văn bản (CAREERJET_TERMS_CONFIRMED)"}
            {ext.flags.careerjet.enabled ? " → nút tìm đang hiện" : " → nút tìm không hiện"}
            {ext.flags.referralFee ? " · có ghi \"PawNail có thể nhận phí giới thiệu\"" : ""}
          </p>
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
