"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Avatar from "@/components/ui/Avatar";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// /r/[token] — khách chấm sao sau buổi làm (link riêng thợ nhắn qua SMS; không cần tài khoản).
interface Info { tech: { id: string; name: string | null; avatarUrl: string | null }; itemName: string | null; suggestedName: string; reviewed: boolean; expired: boolean }
const LABELS: [string, string][] = [["Chưa hài lòng", "Not happy"], ["Tạm được", "Okay"], ["Ổn", "Good"], ["Rất đẹp", "Great"], ["Tuyệt vời!", "Amazing!"]];

export default function ClientReviewPage({ params }: { params: Promise<{ token: string }> }) {
  useTr();
  const { token } = use(params);
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/client-reviews?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then((d: Info) => { setInfo(d); setName(d.suggestedName); })
      .catch((e) => setErr((e as Error).message || tr("Không mở được link đánh giá.", "Couldn't open this review link.")));
  }, [token]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/client-reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, rating, comment, displayName: name }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok || res.status === 409) setDone(true);
    else setErr(d.error || tr("Chưa gửi được, thử lại.", "Couldn't send, try again."));
  };

  const shown = hover || rating;
  const techName = info?.tech.name || "PawNail";
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-8">
        {!info && !err && <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>}
        {err && !info && <p className="rounded-3xl bg-white/[0.03] p-8 text-center text-sm text-slate-300 ring-1 ring-white/10">{err}</p>}
        {info && (
          <section aria-label={tr("Đánh giá buổi làm nail", "Rate your nail appointment")} className="space-y-5 rounded-3xl bg-white/[0.03] p-6 ring-1 ring-white/10">
            <div className="flex flex-col items-center text-center">
              <Avatar src={info.tech.avatarUrl} name={info.tech.name} seed={info.tech.id} className="h-16 w-16" alt="" />
              <p className="mt-3 text-[11px] font-black uppercase tracking-wider text-pink-300">{tr("Đánh giá buổi làm nail", "Rate your nails")}</p>
              <h1 className="text-xl font-black text-white">{techName}</h1>
              {info.itemName && <p className="text-sm text-slate-400">{info.itemName}</p>}
            </div>

            {done || info.reviewed ? (
              <div className="space-y-3 py-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                <p className="text-lg font-black text-white">{tr("Cảm ơn bạn!", "Thank you!")}</p>
                <p className="text-sm text-slate-300">{tr(`Đánh giá của bạn giúp ${techName} được nhiều khách biết tới hơn.`, `Your review helps ${techName} reach more clients.`)}</p>
                <Link href={`/menu/${info.tech.id}`} className="inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">{tr("Xem menu & đặt lần sau", "See the menu & rebook")}</Link>
              </div>
            ) : info.expired ? (
              <p className="py-4 text-center text-sm text-slate-300">{tr("Link đánh giá này đã hết hạn (30 ngày sau buổi làm).", "This review link has expired (30 days after the appointment).")}</p>
            ) : (
              <>
                <div className="text-center">
                  <div className="flex justify-center gap-1.5" role="radiogroup" aria-label={tr("Số sao", "Star rating")} onMouseLeave={() => setHover(0)}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={tr(`${n} sao`, `${n} star${n > 1 ? "s" : ""}`)} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="rounded-xl p-1.5 transition-transform active:scale-90">
                        <Star className={`h-10 w-10 transition-colors ${n <= shown ? "fill-amber-400 text-amber-400" : "text-slate-600"}`} />
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 h-5 text-sm font-bold text-amber-200">{shown ? tr(LABELS[shown - 1][0], LABELS[shown - 1][1]) : ""}</p>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Nhận xét (không bắt buộc)", "Comment (optional)")}</span>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder={tr("Móng đẹp, làm kỹ, đúng giờ…", "Beautiful work, careful, on time…")} className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-base text-white placeholder-slate-500 focus:border-pink-500/60 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Tên hiển thị", "Display name")}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-base text-white focus:border-pink-500/60 focus:outline-none" />
                </label>
                {err && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{err}</p>}
                <button type="button" onClick={submit} disabled={!rating || busy} className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white shadow-lg shadow-pink-600/20 disabled:opacity-40">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Gửi đánh giá", "Submit review")}
                </button>
                <p className="text-center text-[11px] text-slate-500">{tr("Đánh giá hiện công khai trên menu của thợ, kèm nhãn “Khách đã đặt lịch”. Không hiện số điện thoại.", "Reviews appear on the tech's menu with a “Verified booking” label. Your number is never shown.")}</p>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
