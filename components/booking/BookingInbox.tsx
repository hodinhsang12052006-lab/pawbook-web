"use client";

import { apiError } from "@/lib/i18n/apiError";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, Loader2, MessageSquare, Phone, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { currentLocale, tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { useSessionUser } from "@/lib/SessionUserContext";
import FeatureGate from "@/components/common/FeatureGate";
import Avatar from "@/components/ui/Avatar";
import { DEFAULT_HOUR, NEXT, TIME_LABEL, dateLabel, reviewSms, smsText, type BookingStatus, type BookingTime } from "@/lib/booking";
import { SCHEDULED_RE, localYmd, scheduledLabel } from "@/lib/i18n/format";

// "Lịch hẹn" của thợ / tiệm: yêu cầu khách gửi từ menu (không cần tài khoản). Gọi / nhắn SMS soạn sẵn
// từ chính điện thoại thợ (0đ) → xác nhận giờ → đánh dấu đã làm.
interface Booking {
  id: string; itemName: string | null; itemPrice: string | null; clientName: string; clientPhone: string; phoneDisplay: string;
  preferredDate: string | null; preferredTime: string | null; note: string | null; status: BookingStatus; scheduledFor: string | null; locale: string; createdAt: string;
  reviewUrl: string | null;
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
  // Vừa bấm "Đã làm xong" → mời gửi link đánh giá cho khách
  const [askReview, setAskReview] = useState<Booking | null>(null);

  const load = useCallback(async (t: BookingStatus) => {
    setList(null);
    const res = await fetch(`/api/bookings?status=${t}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    setList(d.bookings ?? []);
    setCounts(d.counts ?? {});
  }, []);
  useEffect(() => { if (user && (user.role === "TECHNICIAN" || user.role === "OWNER")) load(tab); }, [user, tab, load]);

  const setStatus = async (b: Booking, status: BookingStatus, scheduledFor?: string) => {
    const res = await fetch(`/api/bookings/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, scheduledFor }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(apiError(d, "Không cập nhật được.", "Couldn't update.")); return; }
    toast.success(status === "confirmed" ? tr("Đã xác nhận lịch", "Booking confirmed") : status === "done" ? tr("Đã đánh dấu làm xong", "Marked as done") : tr("Đã từ chối", "Declined"));
    setList((l) => (l ?? []).filter((x) => x.id !== b.id));
    setCounts((c) => ({ ...c, [b.status]: Math.max(0, (c[b.status] ?? 1) - 1), [status]: (c[status] ?? 0) + 1 }));
    if (status === "done" && d.booking?.reviewUrl) setAskReview(d.booking as Booking);
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
  // Khách (và mọi tài khoản không phải thợ / tiệm): lịch hẹn MÌNH đã gửi — không phải lời mời "nhận lịch" cho thợ.
  if (user && user.role !== "TECHNICIAN" && user.role !== "OWNER") return <ClientBookings />;
  if (!user) {
    return (
      <FeatureGate
        icon={CalendarCheck}
        loggedIn={false}
        path="/bookings"
        title={tr("Lịch hẹn của bạn", "Your bookings")}
        lead={tr("Đăng nhập để xem các yêu cầu đặt lịch bạn đã gửi và giờ tiệm đã xác nhận.", "Sign in to see the booking requests you've sent and the times salons have confirmed.")}
        points={[
          tr("Xem trạng thái từng yêu cầu: đang chờ, đã xác nhận, hay tiệm bận", "See each request's status: waiting, confirmed, or the salon is busy"),
          tr("Nhận thông báo ngay khi tiệm xác nhận giờ", "Get notified as soon as a salon confirms your time"),
          tr("Thợ / tiệm nail: nhận lịch từ khách qua link menu và mã QR riêng", "Nail techs and salons: take client bookings with your own menu link and QR code"),
        ]}
      />
    );
  }
  const techName = user.name || "PawNail";
  const market: string | null = user.market ?? null;

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
          <p className="text-sm font-bold text-slate-200">{tab === "new" ? tr("Chưa có yêu cầu đặt lịch.", "No booking requests yet.") : tr("Chưa có lịch hẹn ở mục này.", "Nothing in this list yet.")}</p>
          {tab === "new" && (
            <p className="mt-1.5 text-xs text-slate-400">
              {tr("Chia sẻ link menu hoặc mã QR để khách gửi yêu cầu đặt lịch. ", "Share your menu link or QR code so clients can request a time. ")}
              <Link href={`/profile/${user.id}?tab=menu`} className="font-bold text-pink-300 hover:underline">{tr("Mở menu của tôi", "Open my menu")}</Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => {
            const en = b.locale === "en";
            const when = [dateLabel(b.preferredDate, currentLocale(), market), b.preferredTime && TIME_LABEL[b.preferredTime as BookingTime] ? tr(TIME_LABEL[b.preferredTime as BookingTime][0], TIME_LABEL[b.preferredTime as BookingTime][1]).toLowerCase() : ""].filter(Boolean).join(" · ");
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
                  {b.scheduledFor && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200">✓ {scheduledLabel(b.scheduledFor, currentLocale(), market)}</span>}
                  {en && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-slate-300">EN</span>}
                </div>
                {b.note && <p className="rounded-2xl bg-black/20 px-3 py-2 text-sm text-slate-300">“{b.note}”</p>}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${b.clientPhone}`} className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10"><Phone className="h-4 w-4 text-emerald-300" />{tr("Gọi", "Call")}</a>
                  <a href={smsHref(b.clientPhone, b.status === "done" && b.reviewUrl ? reviewSms(b, techName, b.reviewUrl) : smsText(b, techName, b.status === "confirmed" ? "confirm" : "ask", market))} className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10"><MessageSquare className="h-4 w-4 text-sky-300" />{b.status === "done" && b.reviewUrl ? tr("Xin đánh giá", "Ask for review") : tr("Nhắn SMS", "Text")}</a>
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

      {askReview && askReview.reviewUrl && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setAskReview(null)}>
          <div role="dialog" aria-label={tr("Xin khách đánh giá", "Ask for a review")} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-t-3xl border border-white/10 bg-slate-950 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
            <p className="text-base font-black text-white">{tr("Xong buổi làm ✓", "Appointment done ✓")}</p>
            <p className="text-sm text-slate-300">{tr(`Nhắn ${askReview.clientName} link đánh giá — đánh giá thật từ khách đã đặt lịch giúp bạn có thêm khách mới.`, `Text ${askReview.clientName} the review link — verified reviews bring you new clients.`)}</p>
            <a href={smsHref(askReview.clientPhone, reviewSms(askReview, techName, askReview.reviewUrl))} onClick={() => setAskReview(null)} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white"><MessageSquare className="h-4 w-4" />{tr("Nhắn xin đánh giá", "Text review link")}</a>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(askReview.reviewUrl!); toast.success(tr("Đã chép link", "Link copied")); } catch { toast(askReview.reviewUrl!); } }} className="w-full text-center text-xs font-bold text-slate-300 hover:text-white">{tr("Chép link (gửi qua Zalo / Messenger)", "Copy link (send via any app)")}</button>
            <button type="button" onClick={() => setAskReview(null)} className="w-full text-center text-xs font-bold text-slate-500">{tr("Để sau", "Later")}</button>
          </div>
        </div>
      )}
      {confirming && <ConfirmTime b={confirming} techName={techName} market={market} onClose={() => setConfirming(null)} onConfirm={(when) => setStatus(confirming, "confirmed", when)} />}
    </div>
  );
}

// Chốt giờ bằng ô CHỌN NGÀY + ô CHỌN GIỜ (lưu "YYYY-MM-DDTHH:mm"). SMS gửi khách định dạng theo ngôn ngữ của
// khách + thị trường của tiệm (en-US "Sat, Nov 7 · 2:30 PM", en-AU "Sat 7 Nov · 2:30 pm") — trước đây ô chữ tự
// do với gợi ý "VD: Thứ 7, 18/10" khiến khách Mỹ nhận "You're booked on Thứ 7, 7/11".
function ConfirmTime({ b, techName, market, onClose, onConfirm }: { b: Booking; techName: string; market: string | null; onClose: () => void; onConfirm: (when: string) => Promise<Booking | undefined | void> }) {
  useTr();
  const today = localYmd();
  const [day, setDay] = useState(b.preferredDate && b.preferredDate >= today ? b.preferredDate : today);
  const [hour, setHour] = useState(b.preferredTime && DEFAULT_HOUR[b.preferredTime as BookingTime] ? DEFAULT_HOUR[b.preferredTime as BookingTime] : "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);
  const when = /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{2}:\d{2}$/.test(hour) ? `${day}T${hour}` : "";
  const preview = when && SCHEDULED_RE.test(when) ? scheduledLabel(when, b.locale === "en" ? "en" : "vi", market) : "";
  const field = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-base text-white placeholder-slate-500 focus:border-pink-500/60 focus:outline-none";
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label={tr("Xác nhận giờ hẹn", "Confirm appointment time")} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-t-3xl border border-white/10 bg-slate-950 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        {done ? (
          <>
            <p className="text-base font-black text-white">{tr("Đã xác nhận ✓", "Confirmed ✓")}</p>
            <p className="text-sm text-slate-300">{tr("Nhắn khách để họ có giờ hẹn trong điện thoại:", "Text the client so they have the time on their phone:")}</p>
            <a href={smsHref(done.clientPhone, smsText(done, techName, "confirm", market))} onClick={onClose} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white"><MessageSquare className="h-4 w-4" />{tr("Nhắn xác nhận cho khách", "Text confirmation")}</a>
            <button type="button" onClick={onClose} className="w-full text-center text-xs font-bold text-slate-400">{tr("Để sau", "Later")}</button>
          </>
        ) : (
          <>
            <h2 className="text-base font-black text-white">{tr(`Chốt giờ với ${b.clientName}`, `Lock in a time with ${b.clientName}`)}</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Ngày", "Date")}</span><input type="date" value={day} min={today} onChange={(e) => setDay(e.target.value)} required className={`${field} [color-scheme:dark]`} /></label>
              <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Giờ", "Time")}</span><input type="time" value={hour} step={900} onChange={(e) => setHour(e.target.value)} required className={`${field} [color-scheme:dark]`} /></label>
            </div>
            {preview && (
              <p className="text-xs text-slate-400">
                {b.locale === "en" ? tr("Khách nhận (tiếng Anh): ", "Client sees: ") : tr("Khách nhận: ", "Client sees (Vietnamese): ")}
                <span className="font-semibold text-slate-200">{preview}</span>
              </p>
            )}
            <button type="button" disabled={!when || busy} onClick={async () => { setBusy(true); const r = await onConfirm(when); setBusy(false); if (r) setDone(r); }} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-slate-900 disabled:opacity-40">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Xác nhận lịch", "Confirm booking")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// "Lịch hẹn của tôi" — KHÁCH xem các yêu cầu đã gửi khi đăng nhập: trạng thái + giờ tiệm đã chốt.
interface ClientBooking {
  id: string; itemName: string | null; itemPrice: string | null; preferredDate: string | null; preferredTime: string | null;
  status: BookingStatus; scheduledFor: string | null; createdAt: string;
  tech: { id: string; name: string; avatarUrl: string | null; market: string | null; city: string | null; state: string | null };
}
const CLIENT_STATUS: Record<BookingStatus, { label: [string, string]; cls: string }> = {
  new: { label: ["Đang chờ tiệm xác nhận", "Waiting for the salon"], cls: "bg-amber-500/15 text-amber-200" },
  confirmed: { label: ["Đã xác nhận", "Confirmed"], cls: "bg-emerald-500/15 text-emerald-200" },
  declined: { label: ["Tiệm không nhận được", "Salon can't take it"], cls: "bg-white/[0.06] text-slate-300" },
  done: { label: ["Đã làm xong", "Completed"], cls: "bg-sky-500/15 text-sky-200" },
};

export function ClientBookings({ compact = false }: { compact?: boolean }) {
  useTr();
  const [list, setList] = useState<ClientBooking[] | null>(null);
  useEffect(() => {
    let off = false;
    fetch("/api/bookings?as=client", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { bookings: [] }))
      .then((d) => { if (!off) setList(Array.isArray(d.bookings) ? d.bookings : []); })
      .catch(() => { if (!off) setList([]); });
    return () => { off = true; };
  }, []);
  const loc = currentLocale();
  const shown = compact ? (list ?? []).slice(0, 3) : list ?? [];
  return (
    <div className="space-y-4">
      {!compact && (
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-white"><CalendarCheck className="h-6 w-6 text-pink-300" />{tr("Lịch hẹn của tôi", "My bookings")}</h1>
          <p className="text-sm text-slate-400">{tr("Yêu cầu đặt lịch bạn đã gửi khi đăng nhập. Tiệm xác nhận là bạn nhận thông báo.", "Requests you've sent while signed in. You'll get a notification when a salon confirms.")}</p>
        </header>
      )}
      {list === null ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl bg-white/[0.03] p-6 text-center ring-1 ring-white/10">
          <p className="text-sm font-bold text-slate-200">{tr("Bạn chưa có lịch hẹn nào.", "You haven't booked anything yet.")}</p>
          <p className="mt-1.5 text-xs text-slate-400">
            {tr("Chọn tiệm hoặc thợ, xem menu rồi bấm Đặt lịch. ", "Pick a salon or tech, browse their menu and tap Book. ")}
            <Link href="/salons" className="font-bold text-pink-300 hover:underline">{tr("Tìm tiệm gần bạn", "Find salons near you")}</Link>
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((b) => {
            const st = CLIENT_STATUS[b.status] ?? CLIENT_STATUS.new;
            const wanted = [dateLabel(b.preferredDate, loc, b.tech.market), b.preferredTime && TIME_LABEL[b.preferredTime as BookingTime] ? tr(TIME_LABEL[b.preferredTime as BookingTime][0], TIME_LABEL[b.preferredTime as BookingTime][1]).toLowerCase() : ""].filter(Boolean).join(" · ");
            return (
              <li key={b.id} className="space-y-2.5 rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                  <Avatar src={b.tech.avatarUrl} name={b.tech.name} seed={b.tech.id} className="h-10 w-10 flex-shrink-0" alt="" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/menu/${b.tech.id}`} className="block truncate text-base font-black text-white hover:underline">{b.tech.name}</Link>
                    <p className="truncate text-xs text-slate-400">{b.itemName ? `${b.itemName}${b.itemPrice ? ` · ${b.itemPrice}` : ""}` : tr("Hỏi lịch chung", "General enquiry")}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>{tr(st.label[0], st.label[1])}</span>
                </div>
                {b.status === "confirmed" && b.scheduledFor ? (
                  <p className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">✓ {scheduledLabel(b.scheduledFor, loc, b.tech.market)}</p>
                ) : wanted ? (
                  <p className="text-xs text-slate-400">{tr("Bạn muốn: ", "You asked for: ")}{wanted}</p>
                ) : null}
                <div className="flex gap-2">
                  <Link href={`/messages?to=${b.tech.id}`} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl bg-white/[0.06] px-3.5 text-xs font-bold text-white ring-1 ring-white/10 hover:bg-white/10"><MessageSquare className="h-4 w-4 text-sky-300" />{tr("Nhắn tiệm", "Message")}</Link>
                  <Link href={`/menu/${b.tech.id}`} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl px-3.5 text-xs font-bold text-slate-300 hover:bg-white/5">{tr("Xem menu", "View menu")}</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {compact && (list?.length ?? 0) > 3 && (
        <Link href="/bookings" className="block text-center text-xs font-bold text-pink-300 hover:underline">{tr(`Xem tất cả ${list!.length} lịch hẹn`, `See all ${list!.length} bookings`)}</Link>
      )}
    </div>
  );
}
