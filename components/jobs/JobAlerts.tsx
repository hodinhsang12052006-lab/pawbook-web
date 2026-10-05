"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BellPlus, BellRing, Loader2, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useSessionUser } from "@/lib/SessionUserContext";
import { enablePush, getPushState } from "@/lib/pushClient";
import { stateName } from "@/lib/stateNames";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { playSound } from "@/lib/sounds";

// "Báo tôi khi có việc như thế này" — thợ lưu tối đa 3 bộ lọc; có tin mới
// khớp (thị trường + bang + kỹ năng) là nhận thông báo đẩy ngay.
const SKILLS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước", "Wax", "Mi/Lông mày"];

export interface JobAlertRow { id: string; market: "US" | "AU"; state: string | null; skill: string | null }

export function alertLabel(a: { market: "US" | "AU"; state: string | null; skill: string | null }) {
  const where = a.state ? stateName(a.market, a.state) || a.state : a.market === "US" ? tr("toàn nước Mỹ", "anywhere in the US") : tr("toàn nước Úc", "anywhere in Australia");
  return a.skill ? tr(`${valueLabel(a.skill)} · ${where}`, `${valueLabel(a.skill)} · ${where}`) : tr(`Mọi việc · ${where}`, `All jobs · ${where}`);
}

async function ensurePush(): Promise<boolean> {
  try {
    const s = await getPushState();
    if (s === "on") return true;
    if (s === "off") return (await enablePush()) === "on";
  } catch {}
  return false;
}

/** Nút trên bảng việc làm (chỉ thợ đã đăng nhập). */
export function JobAlertButton({ market, state }: { market: "US" | "AU"; state: string }) {
  useTr(); // render lại khi đổi VI/EN
  const { user } = useSessionUser();
  const [open, setOpen] = useState(false);
  const [skill, setSkill] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user || user.role !== "TECHNICIAN") return null;

  const save = async () => {
    setBusy(true);
    // Xin quyền thông báo NGAY trong cú bấm (trình duyệt chỉ cho hỏi khi người dùng chủ động).
    const pushOn = await ensurePush();
    try {
      const res = await fetch("/api/job-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market, state: state || null, skill }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr("Không lưu được.", "Couldn't save."));
      playSound("success");
      toast.success(
        pushOn
          ? tr("Đã bật! Có việc mới khớp là bạn nhận thông báo ngay.", "Done! You'll get a notification as soon as a matching job is posted.")
          : tr("Đã lưu. Bật thông báo trong Hồ sơ → Âm thanh để nhận báo ngay cả khi đóng app.", "Saved. Turn on notifications in Profile → Sound to get alerts even when the app is closed."),
        { duration: 5000 }
      );
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Không lưu được.", "Couldn't save."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-200 transition-colors hover:bg-sky-500/20"
      >
        <BellPlus className="h-3.5 w-3.5" /> {tr("Báo tôi khi có việc như này", "Alert me for jobs like this")}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-label={tr("Thông báo việc mới", "New job alert")} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-slate-900 p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-base font-black text-white"><BellRing className="h-5 w-5 text-sky-300" />{tr(" Báo tôi khi có việc mới", " Alert me about new jobs")}</p>
                <p className="mt-1 text-xs text-slate-400">{tr("Khu vực: ", "Area: ")}<span className="font-bold text-slate-200">{alertLabel({ market, state: state || null, skill: null }).split(" · ")[1]}</span></p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={tr("Đóng", "Close")} className="rounded-full p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-500">{tr("Kỹ năng (không bắt buộc)", "Skill (optional)")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={skill === null} onClick={() => setSkill(null)} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${skill === null ? "bg-sky-500/20 text-sky-100 ring-sky-400/60" : "text-slate-400 ring-white/10"}`}>{tr("Mọi việc", "Any job")}</button>
              {SKILLS.map((s) => (
                <button key={s} type="button" aria-pressed={skill === s} onClick={() => setSkill(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${skill === s ? "bg-sky-500/20 text-sky-100 ring-sky-400/60" : "text-slate-400 ring-white/10"}`}>{valueLabel(s)}</button>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={save} className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-sm font-black text-white shadow-lg shadow-sky-600/25 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} {tr("Bật thông báo việc", "Turn on job alerts")}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">{tr("Tối đa 3 thông báo · quản lý trong Hồ sơ", "Up to 3 alerts · manage them in Profile")}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** Danh sách + xoá, trong trang Tài khoản. */
export function JobAlertsManager() {
  useTr(); // render lại khi đổi VI/EN
  const [alerts, setAlerts] = useState<JobAlertRow[] | null>(null);
  const load = useCallback(() => {
    fetch("/api/job-alerts")
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((d) => setAlerts(d.alerts || []))
      .catch(() => setAlerts([]));
  }, []);
  useEffect(load, [load]);

  const remove = async (id: string) => {
    setAlerts((a) => a?.filter((x) => x.id !== id) ?? null);
    const res = await fetch(`/api/job-alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(tr("Không xoá được, thử lại.", "Couldn't delete, try again."));
      load();
    }
  };

  if (!alerts) return <div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />;
  if (!alerts.length) {
    return <p className="text-xs leading-relaxed text-slate-400">{tr("Chưa có. Vào tab Việc làm, chọn bang rồi bấm “Báo tôi khi có việc như này” — có tin khớp là bạn nhận thông báo ngay.", "None yet. Open the Jobs tab, pick a state and tap “Alert me for jobs like this” — you'll be notified as soon as a matching job is posted.")}</p>;
  }
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li key={a.id} className="flex items-center gap-2.5 rounded-xl bg-slate-950/50 px-3 py-2.5 ring-1 ring-white/5">
          <BellRing className="h-4 w-4 flex-shrink-0 text-sky-300" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">{alertLabel(a)}</span>
          <button type="button" onClick={() => remove(a.id)} aria-label={tr("Xoá thông báo này", "Delete this alert")} className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
        </li>
      ))}
    </ul>
  );
}
