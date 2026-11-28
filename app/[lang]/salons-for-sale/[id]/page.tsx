"use client";

// Trang 1 tin SANG TIỆM: ảnh, giá sang, số liệu, mô tả, gọi / nhắn tin chủ tiệm; người đăng: Đã sang / Đăng lại / Xoá.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, MapPin, MessageCircle, Phone, RotateCcw, Share2, ShieldCheck, Trash2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import MediaLightbox from "@/components/ui/MediaLightbox";
import { saleFacts, salePlace, SalePrice, saleTitle } from "@/components/salonSale/SaleViews";
import { useSessionUser } from "@/lib/SessionUserContext";
import { formatPhone, telHref } from "@/lib/phoneFormat";
import { timeAgo } from "@/lib/feedFormat";
import { localeHref } from "@/lib/i18n/localeHref";
import { apiError } from "@/lib/i18n/apiError";
import { useTr } from "@/lib/i18n/useTr";
import { hasVietnamese } from "@/lib/i18n/viText";
import type { PublicSale } from "@/lib/salonSale/store";

export default function SalonSalePage() {
  const { tr } = useTr();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSessionUser();
  const [s, setS] = useState<PublicSale | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "gone">("loading");
  const [expired, setExpired] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/salon-sales/${encodeURIComponent(id)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as PublicSale) : null))
      .catch(() => null)
      .then((d) => {
        if (!live) return;
        setS(d);
        setExpired(!!d && new Date(d.expiresAt).getTime() <= Date.now());
        setState(d ? "ok" : "gone");
      });
    return () => {
      live = false;
    };
  }, [id, user?.id]);

  const act = async (action: "sold" | "relist") => {
    setBusy(true);
    const r = await fetch(`/api/salon-sales/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return toast.error(apiError(d, "Không cập nhật được tin.", "Couldn't update the listing."));
    setS(d as PublicSale);
    if (action === "relist") setExpired(false);
    toast.success(action === "sold" ? tr("Đã đánh dấu đã sang", "Marked as sold") : tr("Tin đã hiện lại", "Your listing is live again"));
  };
  const remove = async () => {
    if (!confirm(tr("Xoá tin sang tiệm này? Không khôi phục được.", "Delete this listing? This can't be undone."))) return;
    setBusy(true);
    const r = await fetch(`/api/salon-sales/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return toast.error(tr("Không xoá được tin.", "Couldn't delete the listing."));
    toast.success(tr("Đã xoá tin", "Listing deleted"));
    router.push(localeHref("/salons-for-sale"));
  };
  const share = async () => {
    if (!s) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: saleTitle(s), text: `${saleTitle(s)} · ${salePlace(s)}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(tr("Đã chép link", "Link copied"));
      }
    } catch {
      /* người dùng huỷ */
    }
  };

  const back = (
    <Link href="/salons-for-sale" className="mb-4 inline-flex min-h-[40px] items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
      <ArrowLeft className="h-4 w-4" /> {tr("Tất cả tiệm đang sang", "All salons for sale")}
    </Link>
  );

  if (state !== "ok" || !s) {
    return (
      <div className="flex min-h-screen flex-col text-slate-100">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {back}
          {state === "loading" ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-pink-500" /></div>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center" data-sale-gone>
              <p className="font-bold text-white">{tr("Tin này không còn", "This listing is no longer available")}</p>
              <p className="mt-1 text-sm text-slate-400">{tr("Tiệm có thể đã sang xong hoặc người đăng đã gỡ tin.", "The salon may have sold, or the owner removed the listing.")}</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  const facts = saleFacts(s);
  const sold = s.status === "sold";

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28 md:pb-10">
        {back}
        {(sold || expired) && (
          <p role="status" className="mb-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 ring-1 ring-amber-500/25" data-sale-sold>
            {sold ? tr("Tiệm này đã sang xong.", "This salon has been sold.") : tr("Tin này đã hết hạn hiển thị.", "This listing has expired.")}
          </p>
        )}

        <article className="glass-card overflow-hidden rounded-2xl">
          {s.media.length > 0 && (
            <div className="grid grid-cols-4 gap-1 bg-slate-950">
              {s.media.slice(0, 5).map((u, i) => (
                <button key={u} type="button" onClick={() => setViewer(i)} aria-label={tr(`Xem ảnh ${i + 1}`, `View photo ${i + 1}`)} className={`relative overflow-hidden bg-slate-900 ${i === 0 ? "col-span-4 aspect-[16/9]" : "aspect-square"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
                  {i === 4 && s.media.length > 5 && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold text-white">+{s.media.length - 5}</span>}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-5 p-5 sm:p-6">
            <header className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl font-black leading-snug text-white sm:text-2xl">{saleTitle(s)}</h1>
                  {s.salonName && <p className="truncate font-semibold text-slate-400">{s.salonName}</p>}
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-semibold text-slate-400">{tr("Giá sang", "Asking price")}</p>
                  <SalePrice s={s} className="text-2xl text-pink-200" />
                </div>
              </div>
              <p className="flex min-w-0 items-center gap-1.5 text-sm text-slate-300">
                <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 break-words">{[s.address, salePlace(s)].filter(Boolean).join(" · ")}</span>
              </p>
              <p className="text-xs text-slate-500">
                {tr("Đăng", "Posted")} {timeAgo(s.createdAt)}
                {s.fromGroup && <> · {tr("Từ nhóm cộng đồng PawNail", "From PawNail community groups")}</>}
              </p>
            </header>

            {facts.length > 0 && (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-sale-facts>
                {facts.map((f) => (
                  <div key={f.key} className="min-w-0 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10">
                    <dt className="flex items-center gap-1.5 text-xs text-slate-400"><f.icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{f.label}</span></dt>
                    <dd className="mt-0.5 text-base font-bold tabular-nums text-white">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {s.description && (
              <section>
                <h2 className="mb-1.5 text-sm font-bold text-slate-200">{tr("Mô tả", "Description")}</h2>
                <p lang={hasVietnamese(s.description) ? "vi" : undefined} className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">{s.description}</p>
              </section>
            )}

            {!sold && (
              <div className="grid gap-2 sm:grid-cols-2">
                <a href={telHref(s.phone, s.market)} data-sale-call className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 font-bold text-white hover:bg-pn-brand-hover">
                  <Phone className="h-4 w-4" /> {tr("Gọi", "Call")} {formatPhone(s.phone, s.market)}
                </a>
                {s.seller && s.seller.id !== user?.id ? (
                  <button type="button" data-sale-message onClick={() => router.push(localeHref(user?.id ? `/messages?to=${s.seller!.id}` : "/auth/login"))} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 font-bold text-slate-100 ring-1 ring-white/15 hover:bg-white/5">
                    <MessageCircle className="h-4 w-4" /> {tr("Nhắn tin chủ tiệm", "Message the owner")}
                  </button>
                ) : (
                  <button type="button" onClick={share} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 font-bold text-slate-100 ring-1 ring-white/15 hover:bg-white/5">
                    <Share2 className="h-4 w-4" /> {tr("Chia sẻ", "Share")}
                  </button>
                )}
              </div>
            )}

            {s.sourceUrl && (
              <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-pink-300 hover:underline">
                <ExternalLink className="h-4 w-4" /> {tr("Xem bài gốc", "View original post")}
              </a>
            )}

            <p className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-xs leading-relaxed text-slate-400 ring-1 ring-white/10">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              {tr("Đến tận nơi xem tiệm, xem giấy tờ thuê nhà và sổ sách doanh thu trước khi đặt cọc. PawNail không giữ tiền và không làm trung gian mua bán.", "Visit the salon and check the lease and revenue records before paying any deposit. PawNail doesn't hold money or broker the sale.")}
            </p>

            {s.canManage && (
              <section className="space-y-2 border-t border-white/10 pt-4" aria-label={tr("Quản lý tin", "Manage listing")} data-sale-manage>
                <p className="text-sm font-bold text-slate-200">{tr("Tin của bạn", "Your listing")}</p>
                <div className="flex flex-wrap gap-2">
                  {sold || expired ? (
                    <button type="button" disabled={busy} onClick={() => act("relist")} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-slate-100 ring-1 ring-white/15 hover:bg-white/5">
                      <RotateCcw className="h-4 w-4" /> {tr("Đăng lại tin", "Relist")}
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => act("sold")} data-sale-mark-sold className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/10">
                      <CheckCircle2 className="h-4 w-4" /> {tr("Đánh dấu đã sang", "Mark as sold")}
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={remove} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/10">
                    <Trash2 className="h-4 w-4" /> {tr("Xoá tin", "Delete")}
                  </button>
                </div>
              </section>
            )}
          </div>
        </article>
      </main>
      {viewer !== null && <MediaLightbox urls={s.media} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
