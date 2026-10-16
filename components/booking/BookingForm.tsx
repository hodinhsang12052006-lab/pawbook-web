"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Loader2, X } from "lucide-react";
import { tr, currentLocale } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { TIMES, TIME_LABEL, dateLabel, type BookingTime } from "@/lib/booking";

// Khách đặt lịch KHÔNG cần tài khoản: tên + SĐT + ngày / buổi → gửi cho đúng thợ / tiệm này.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DRAFT = "pn_booking_contact"; // nhớ tên + SĐT trên máy khách cho lần sau (chỉ trên máy này)

export default function BookingForm({ techId, techName, item, onClose }: {
  techId: string;
  techName: string;
  item?: { id: string; name: string; price: string } | null;
  onClose: () => void;
}) {
  useTr();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<BookingTime | null>(null);
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // ô bẫy bot — người thật không thấy
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || "{}"); if (d.name) setName(d.name); if (d.phone) setPhone(d.phone); } catch {}
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const locale = currentLocale() === "en" ? "en" : "vi";
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return ymd(d); }), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ techId, menuItemId: item?.id ?? null, name, phone, date, time, note, website, locale }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || tr("Chưa gửi được, thử lại.", "Couldn't send, please try again."));
      try { localStorage.setItem(DRAFT, JSON.stringify({ name, phone })); } catch {}
      setSent(true);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-base text-white placeholder-slate-500 focus:border-pink-500/60 focus:outline-none";
  const chip = (on: boolean) => `flex-shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${on ? "bg-white text-slate-900" : "bg-white/[0.05] text-slate-300 ring-1 ring-white/10 hover:bg-white/10"}`;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label={tr("Đặt lịch", "Book an appointment")} onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-white/5 px-5 py-4">
          <CalendarCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-pink-300" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-white">{tr(`Đặt lịch với ${techName}`, `Book with ${techName}`)}</h2>
            {item && <p className="truncate text-xs text-slate-400">{item.name} · <span className="font-bold text-emerald-300">{item.price}</span></p>}
          </div>
          <button type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="-mr-2 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {sent ? (
          <div className="space-y-3 px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <p className="text-lg font-black text-white">{tr("Đã gửi yêu cầu!", "Request sent!")}</p>
            <p className="text-sm text-slate-300">{tr(`${techName} sẽ gọi hoặc nhắn số ${phone} để chốt giờ với bạn.`, `${techName} will call or text ${phone} to confirm a time.`)}</p>
            <button type="button" onClick={onClose} className="mt-2 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-slate-900">{tr("Xong", "Done")}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Tên của bạn", "Your name")}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} autoComplete="name" placeholder={tr("VD: Ngọc Anh", "e.g. Anna")} className={field} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Số điện thoại", "Phone number")}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" inputMode="tel" autoComplete="tel" placeholder="(214) 555-0123" className={field} />
              </label>
              <div>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Ngày muốn ghé", "Preferred day")}</span>
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                  {days.map((d, i) => (
                    <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(date === d ? null : d)} className={chip(date === d)}>
                      {i === 0 ? tr("Hôm nay", "Today") : i === 1 ? tr("Ngày mai", "Tomorrow") : dateLabel(d, locale)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Buổi", "Time of day")}</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {TIMES.map((t) => <button key={t} type="button" aria-pressed={time === t} onClick={() => setTime(time === t ? null : t)} className={chip(time === t)}>{tr(TIME_LABEL[t][0], TIME_LABEL[t][1])}</button>)}
                </div>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Ghi chú (không bắt buộc)", "Note (optional)")}</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder={tr("VD: muốn đổi màu hồng, có tháo gel cũ…", "e.g. pink instead, need gel removal…")} className={`${field} resize-none`} />
              </label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              <p className="text-[11px] leading-relaxed text-slate-500">{tr(`Tên và số điện thoại chỉ gửi cho ${techName} để liên hệ xác nhận lịch — không hiện công khai.`, `Your name and number go only to ${techName} to confirm the booking — never shown publicly.`)}</p>
              {err && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{err}</p>}
            </div>
            <div className="border-t border-white/5 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
              <button type="submit" disabled={busy} className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white shadow-lg shadow-pink-600/20 disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}{tr("Gửi yêu cầu đặt lịch", "Send booking request")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
