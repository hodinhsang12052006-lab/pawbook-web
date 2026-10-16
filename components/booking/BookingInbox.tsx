"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, Loader2, MessageSquare, Phone, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { useSessionUser } from "@/lib/SessionUserContext";
import { NEXT, TIME_LABEL, dateLabel, smsText, type BookingStatus, type BookingTime } from "@/lib/booking";

// "Lịch hẹn" của thợ / tiệm: yêu cầu khách gửi từ menu (không cần tài khoản). Gọi / nhắn SMS soạn sẵn
// từ chính điện thoại thợ (0đ) → xác nhận giờ → đánh dấu đã làm.
interface Booking {
  id: string; itemName: string | null; itemPrice: string | null; clientName: string; clientPhone: string; phoneDisplay: string;
  preferredDate: string | null; preferredTime: string | null; note: string | null; status: BookingStatus; scheduledFor: string | null; locale: string; createdAt: string;
}
const TABS: { id: BookingStatus; label: [string, string] }[] = [
  { id: "new", label: ["Mới", "New"] },
  { id: "confirmed", label: ["Đã hẹn", "Confirmed"] },
  { id: "done", label: ["Đã làm", "Done"] },
  { id: "declined", label: ["Từ chối", "Declined"] },
];
const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return tr(`${m} phút trước`, `${m}m ago`);
  const h = Math.round(m / 60);
  if (h < 24) return tr(`${h} giờ trước`, `${h}h ago`);
  return tr(`${Math.round(h / 24)} ngày trước`, `${Math.round(h / 24)}d ago`);
};
// iOS dùng "sms:SỐ&body=", Android "sms:SỐ?body=" — "?&body=" chạy được cả hai
const smsHref = (phone: string, body: string) => `sms:${phone}?&body=${encodeURIComponent(body)}`;

export default function BookingInbox() {
  useTr();
  const { user, loading } = useSessionUser();
  const [tab, setTab] = useState<BookingStatus>("new");
  const [list, setList] = useState<Booking[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState<Booking | null>(null);

  const load = useCallback(async (t: BookingStatus) => {
    setList(null);
    const res = await fetch(`/api/bookings?status=${t}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    setList(d.bookings ?? []);
    setCounts(d.counts ?? {});
  }, []);
  useEffect(() => { if (user) load(tab); }, [user, tab, load]);

  const setStatus = async (b: Booking, status: BookingStatus, scheduledFor?: string) => {
    const res = await fetch(`/api/bookings/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, scheduledFor }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error || tr("Không cập nhật được.", "Couldn't update.")); return; }
    toast.success(status === "confirmed" ? tr("Đã xác nhận lịch", "Booking confirmed") : status === "done" ? tr("Đã đánh dấu làm xong", "Marked as done") : tr("Đã từ chối", "Declined"));
    setList((l) => (l ?? []).filter((x) => x.id !== b.id));
    setCounts((c) => ({ ...c, [b.status]: Math.max(0, (c[b.status] ?? 1) - 1), [status]: (c[status] ?? 0) + 1 }));
    return d.booking as Booking;
  };
  const remove = async (b: Booking) => {
    if (!confirm(tr(`Xoá yêu cầu của ${b.clientName}? (xoá luôn số điện thoại)`, `Delete ${b.clientName}'s request? (removes their number)`))) return;
    const res = await fetch(`/api/bookings/${b.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(tr("Không xoá được.", "Couldn't delete."));
    setList((l) => (l ?? []).filter((x) => x.id !== b.id));
    setCounts((c) => ({ ...c, [b.status]: Math.max(0, (c[b.status] ?? 1) - 1) }));
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>;
  if (!user || (user.role !== "TECHNICIAN" && user.role !== "OWNER")) {
    return <p className="rounded-3xl bg-white/[0.03] p-8 text-center text-sm text-slate-400 ring-1 ring-white/10">{tr("Trang dành cho thợ và chủ tiệm.", "For nail techs and salon owners.")}</p>;
  }
  const techName = user.name || "PawNail";

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-white"><CalendarCheck className="h-6 w-6 text-pink-300" />{tr("Lịch hẹn", "Bookings")}</h1>
        <p className="text-sm text-slate-400">{tr("Khách đặt từ menu của bạn (link / mã QR) — gọi hoặc nhắn để chốt giờ.", "Requests from your menu (link / QR) — call or text to lock in a time.")}</p>
      </header>

      <nav aria-label={tr("Trạng thái lịch hẹn", "Booking status")} className="grid grid-cols-4 gap-1 rounded-2xl bg-white/[0.03] p-1 ring-1 ring-white/10">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition-colors ${tab === t.id ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}>
            {tr(t.label[0], t.label[1])}
            {(counts[t.id] ?? 0) > 0 && <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-pink-500 text-white" : "bg-white/10"}`}>{counts[t.id]}</span>}
          </button>
        ))}
      </nav>

      {list === null ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl bg-white/[0.03] p-8 text-center ring-1 ring-white/10">
          <p className="text-sm font-bold text-slate-200">{tab === "new" ? tr("Chưa có yêu cầu mới", "No new requests") : tr("Trống", "Nothing here")}</p>
          {tab === "new" && (
            <p className="mt-1.5 text-xs text-slate-400">
              {tr("Chia sẻ link menu hoặc in mã QR dán ở quầy để khách đặt lịch. ", "Share your menu link or print the QR code so clients can book. ")}
              <Link href={`/profile/${user.id}?tab=menu`} className="font-bold text-pink-300 hover:underline">{tr("Mở menu của tôi", "Open my menu")}</Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => {
            const en = b.locale === "en";
            const when = [dateLabel(b.preferredDate, en ? "en" : "vi"), b.preferredTime && TIME_LABEL[b.preferredTime as BookingTime] ? tr(TIME_LABEL[b.preferredTime as BookingTime][0], TIME_LABEL[b.preferredTime as BookingTime][1]).toLowerCase() : ""].filter(Boolean).join(" · ");
            const can = NEXT[b.status] ?? [];
            return (
              <li key={b.id} aria-label={tr(`Lịch của ${b.clientName}`, `${b.clientName}'s booking`)} className="space-y-3 rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-sm font-black text-white">{b.clientName.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2"><span className="truncate text-base font-black text-white">{b.clientName}</span><span className="flex-shrink-0 text-[11px] text-slate-500">{ago(b.createdAt)}</span></p>
                    <a href={`tel:${b.clientPhone}`} className="text-sm font-semibold text-sky-300">{b.phoneDisplay}</a>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  <span className="rounded-full bg-pink-500/10 px-2.5 py-1 text-pink-200">{b.itemName ? `${b.itemName}${b.itemPrice ? ` · ${b.itemPrice}` : ""}` : tr("Hỏi lịch chung", "General enquiry")}</span>
                  {when && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-slate-200">{tr("Muốn: ", "Wants: ")}{when}</span>}
                  {b.scheduledFor && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200">✓ {b.scheduledFor}</span>}
                  {en && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-slate-300">EN</span>}
                </div>
                {b.note && <p className="rounded-2xl bg-black/20 px-3 py-2 text-sm text-slate-300">“{b.note}”</p>}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${b.clientPhone}`} className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10"><Phone className="h-4 w-4 text-emerald-300" />{tr("Gọi", "Call")}</a>
                  <a href={smsHref(b.clientPhone, smsText(b, techName, b.status === "confirmed" ? "confirm" : "ask"))} className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10"><MessageSquare className="h-4 w-4 text-sky-300" />{tr("Nhắn SMS", "Text")}</a>
                </div>
                {(can.length > 0 || b.status === "done" || b.status === "declined") && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                    {can.includes("confirmed") && <button type="button" onClick={() => setConfirming(b)} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-3.5 py-2 text-xs font-bold text-white"><Check className="h-3.5 w-3.5" />{tr("Xác nhận giờ", "Confirm time")}</button>}
                    {can.includes("done") && <button type="button" onClick={() => setStatus(b, "done")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-500/30"><Check className="h-3.5 w-3.5" />{tr("Đã làm xong", "Mark done")}</button>}
                    {can.includes("declined") && <button type="button" onClick={() => setStatus(b, "declined")} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/5"><X className="h-3.5 w-3.5" />{tr("Từ chối", "Decline")}</button>}
                    <button type="button" onClick={() => remove(b)} aria-label={tr("Xoá yêu cầu", "Delete request")} className="ml-auto rounded-xl p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {confirming && <ConfirmTime b={confirming} techName={techName} onClose={() => setConfirming(null)} onConfirm={(when) => setStatus(confirming, "confirmed", when)} />}
    </div>
  );
}

function ConfirmTime({ b, techName, onClose, onConfirm }: { b: Booking; techName: string; onClose: () => void; onConfirm: (when: string) => Promise<Booking | undefined | void> }) {
  useTr();
  const en = b.locale === "en";
  const [day, setDay] = useState(dateLabel(b.preferredDate, en ? "en" : "vi"));
  const [hour, setHour] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);
  const when = [day.trim(), hour.trim()].filter(Boolean).join(" · ");
  const field = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-base text-white placeholder-slate-500 focus:border-pink-500/60 focus:outline-none";
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label={tr("Xác nhận giờ hẹn", "Confirm appointment time")} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-t-3xl border border-white/10 bg-slate-950 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        {done ? (
          <>
            <p className="text-base font-black text-white">{tr("Đã xác nhận ✓", "Confirmed ✓")}</p>
            <p className="text-sm text-slate-300">{tr("Nhắn khách để họ có giờ hẹn trong điện thoại:", "Text the client so they have the time on their phone:")}</p>
            <a href={smsHref(done.clientPhone, smsText(done, techName, "confirm"))} onClick={onClose} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white"><MessageSquare className="h-4 w-4" />{tr("Nhắn xác nhận cho khách", "Text confirmation")}</a>
            <button type="button" onClick={onClose} className="w-full text-center text-xs font-bold text-slate-400">{tr("Để sau", "Later")}</button>
          </>
        ) : (
          <>
            <h2 className="text-base font-black text-white">{tr(`Chốt giờ với ${b.clientName}`, `Lock in a time with ${b.clientName}`)}</h2>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Ngày", "Day")}</span><input value={day} onChange={(e) => setDay(e.target.value)} maxLength={30} placeholder={tr("VD: Thứ 7, 18/10", "e.g. Sat, Oct 18")} className={field} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Giờ", "Time")}</span><input value={hour} onChange={(e) => setHour(e.target.value)} maxLength={20} placeholder="2:30 PM" className={field} /></label>
            <button type="button" disabled={!when || busy} onClick={async () => { setBusy(true); const r = await onConfirm(when); setBusy(false); if (r) setDone(r); }} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-slate-900 disabled:opacity-40">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Xác nhận lịch", "Confirm booking")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
