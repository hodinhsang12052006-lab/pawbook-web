"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Clock, Loader2, MapPin, Store, X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { timeAgo } from "@/lib/feedFormat";

// Tin PawNail ĐĂNG HỘ tiệm (tiệm nhờ đăng): ghi rõ nguồn, địa chỉ + bản đồ, hết hạn;
// tiệm có thể "nhận tin" (tự quản lý trên PawNail) hoặc "gỡ tin" — gửi yêu cầu cho admin.
export function PostedForSalonBanner({ postedAt, expired, address, repostCount }: { postedAt?: string | null; expired?: boolean; address?: string | null; repostCount?: number }) {
  return (
    <div className="space-y-2">
      {expired && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm font-semibold text-amber-200 ring-1 ring-amber-500/25">
          <Clock className="h-4 w-4 shrink-0" />{tr(" Tin này đã hết hạn — tiệm có thể đã tuyển đủ. Gọi hỏi trước khi đi nhé.", " This listing has expired — the salon may be fully staffed. Call first.")}
        </p>
      )}
      <p className="flex items-start gap-2 rounded-xl bg-sky-500/10 px-3 py-2.5 text-xs leading-relaxed text-sky-100 ring-1 ring-sky-500/25">
        <Store className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        <span>
          {tr("PawNail đăng hộ theo yêu cầu của tiệm", "Posted by PawNail on the salon's behalf")}
          {postedAt ? tr(` · tiệm gửi ${timeAgo(postedAt)}`, ` · sent ${timeAgo(postedAt)}`) : ""}
          {repostCount && repostCount > 1 ? tr(` · tiệm đã đăng lại ${repostCount} lần (đang cần người)`, ` · reposted ${repostCount} times (still hiring)`) : ""}
          {tr(". Gọi trực tiếp số của tiệm để hỏi việc.", ". Call the salon directly to ask about the job.")}
        </span>
      </p>
      {address && (
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.07]">
          <MapPin className="h-4 w-4 shrink-0 text-pink-300" />
          <span className="min-w-0 flex-1 truncate">{address}</span>
          <span className="shrink-0 text-xs font-bold text-pink-300">{tr("Bản đồ", "Map")}</span>
        </a>
      )}
    </div>
  );
}

export function SalonRequestLinks({ jobId }: { jobId: string }) {
  const [kind, setKind] = useState<"claim" | "remove" | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!kind || !name.trim() || contact.trim().length < 6) { toast.error(tr("Nhập tên và SĐT/email để PawNail liên hệ lại.", "Enter your name and phone/email.")); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/jobs/${jobId}/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, name, contact, note }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || tr("Gửi chưa được, thử lại sau.", "Couldn't send, try again.")); return; }
      toast.success(kind === "remove" ? tr("Đã gửi yêu cầu gỡ tin — PawNail xử lý trong 24 giờ.", "Removal request sent — handled within 24 hours.") : tr("Đã gửi — PawNail sẽ liên hệ để chuyển tin cho bạn quản lý.", "Sent — we'll contact you to hand the listing over."));
      setKind(null); setName(""); setContact(""); setNote("");
    } finally { setBusy(false); }
  };
  return (
    <>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-xs">
        <button type="button" onClick={() => setKind("claim")} className="min-h-[36px] font-semibold text-sky-300 hover:text-sky-200">{tr("Tôi là chủ tiệm này", "I own this salon")}</button>
        <button type="button" onClick={() => setKind("remove")} className="min-h-[36px] font-semibold text-slate-400 hover:text-slate-200">{tr("Gỡ tin này", "Remove this listing")}</button>
      </div>
      {kind && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 px-0 sm:items-center sm:px-4" role="dialog" aria-modal="true" aria-label={kind === "claim" ? tr("Nhận tin", "Claim listing") : tr("Gỡ tin", "Remove listing")} onClick={() => !busy && setKind(null)}>
          <div className="w-full space-y-3 rounded-t-3xl bg-slate-950 p-5 ring-1 ring-white/10 sm:max-w-sm sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-white">{kind === "claim" ? tr("Nhận lại tin này", "Claim this listing") : tr("Gỡ tin này", "Remove this listing")}</p>
                <p className="mt-0.5 text-xs text-slate-400">{kind === "claim" ? tr("PawNail xác minh rồi chuyển tin sang tài khoản của bạn — tự sửa, nhận tin nhắn của thợ.", "We verify you, then move the listing to your account so you can edit it and get messages.") : tr("PawNail gỡ tin trong 24 giờ và không đăng lại số này.", "We remove it within 24 hours and won't repost this number.")}</p>
              </div>
              <button type="button" onClick={() => setKind(null)} aria-label={tr("Đóng", "Close")} className="-m-1 rounded-full p-2 text-slate-400 hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Tên của bạn / tên tiệm", "Your name / salon name")} className="input-field" autoComplete="name" />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={tr("SĐT hoặc email để liên hệ lại", "Phone or email to reach you")} className="input-field" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={tr("Ghi chú (không bắt buộc)", "Note (optional)")} className="input-field" />
            <button type="button" onClick={send} disabled={busy} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-bold text-white disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Gửi yêu cầu", "Send request")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
