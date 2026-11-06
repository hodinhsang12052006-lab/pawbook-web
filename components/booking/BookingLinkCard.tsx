"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Share2, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// Lịch hẹn trống: thay vì 70% màn hình trống + 1 nút, hiện NGAY link đặt lịch + mã QR (chép / chia sẻ) và 3 bước
// khách đặt lịch thế nào. Link = menu công khai /menu/[uid] (khách đặt không cần tài khoản).
export default function BookingLinkCard({ userId, name }: { userId: string; name: string }) {
  useTr();
  // Thẻ chỉ hiện sau khi danh sách lịch hẹn tải xong ở trình duyệt → đọc origin ngay lúc khởi tạo
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [qr, setQr] = useState<string | null>(null);
  const url = `${origin}/menu/${userId}`;
  useEffect(() => {
    if (!origin) return;
    let off = false;
    import("qrcode").then((Q) => Q.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: "M", color: { dark: "#1c1521", light: "#ffffff" } })).then((d) => { if (!off) setQr(d); }).catch(() => {});
    return () => { off = true; };
  }, [origin, url]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success(tr("Đã chép link đặt lịch", "Booking link copied")); } catch { toast(url); }
  };
  const share = async () => {
    const text = tr(`Đặt lịch làm nail với ${name}:`, `Book your nails with ${name}:`);
    if (navigator.share) { try { await navigator.share({ title: name, text, url }); return; } catch { return; } }
    copy();
  };
  const steps: [string, string][] = [
    [tr("Khách mở link hoặc quét mã QR", "Clients open your link or scan the QR"), tr("Không cần tài khoản", "No account needed")],
    [tr("Chọn mẫu & giờ muốn làm", "They pick a look and a time"), tr("Từ menu có giá của bạn", "From your priced menu")],
    [tr("Yêu cầu hiện ở đây", "The request lands here"), tr("Gọi hoặc nhắn để chốt giờ", "Call or text to confirm")],
  ];

  return (
    <div className="space-y-3 text-left">
      <section className="glass-card rounded-2xl p-4" aria-label={tr("Link đặt lịch của bạn", "Your booking link")}>
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt={tr("Mã QR đặt lịch", "Booking QR code")} className="h-full w-full" /> : <div className="h-full w-full animate-pulse rounded-lg bg-slate-200" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-5 text-pn-text">{tr("Link đặt lịch của bạn", "Your booking link")}</p>
            <p className="mt-1 truncate text-[13px] text-pn-text-2">{url.replace(/^https?:\/\//, "") || "…"}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={copy} className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm font-semibold text-pn-text ring-1 ring-white/10 active:scale-[.97]">
                <Copy className="h-4 w-4" />{tr("Chép", "Copy")}
              </button>
              <button type="button" onClick={share} className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-pink-600 px-3 text-sm font-semibold text-white active:scale-[.97]">
                <Share2 className="h-4 w-4" />{tr("Chia sẻ", "Share")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <ol className="grid gap-2 sm:grid-cols-3" aria-label={tr("Khách đặt lịch thế nào", "How clients book")}>
        {steps.map(([t, s], i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06] sm:flex-col sm:gap-2">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pn-brand-tint text-[13px] font-semibold text-pink-200 tabular-nums">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold leading-5 text-pn-text">{t}</span>
              <span className="block text-[12px] leading-4 text-pn-text-3">{s}</span>
            </span>
          </li>
        ))}
      </ol>

      <Link href={`/profile/${userId}?tab=menu`} className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-pink-300 hover:underline">
        <BookOpen className="h-4 w-4" />{tr("Mở menu của tôi", "Open my menu")}
      </Link>
    </div>
  );
}
