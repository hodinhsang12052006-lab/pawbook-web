"use client";

// Đăng tin SANG TIỆM (chủ tiệm). 1 trang: khu vực · giá & số liệu · mô tả · ảnh · SĐT.
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, ImagePlus, Loader2, Send, X } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Flag from "@/components/ui/Flag";
import { AU_ALL_CODES, stateName, US_ALL_CODES } from "@/lib/stateNames";
import { guessState } from "@/lib/cityState";
import { marketPhoneError, parseMarketPhone } from "@/lib/phoneFormat";
import { uploadMedia } from "@/lib/mediaUpload";
import { localeHref } from "@/lib/i18n/localeHref";
import { apiError } from "@/lib/i18n/apiError";
import { useTr } from "@/lib/i18n/useTr";
import { playSound } from "@/lib/sounds";

const MAX_PHOTOS = 10;
interface Photo { key: string; url?: string; preview: string; progress: number; error?: string }

export default function NewSalonSalePage() {
  const { tr } = useTr();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("CA");
  const [city, setCity] = useState("");
  const [salonName, setSalonName] = useState("");
  const [title, setTitle] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [chairs, setChairs] = useState("");
  const [tables, setTables] = useState("");
  const [sqft, setSqft] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const session = await fetch("/api/auth/session").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!session?.user) {
        router.replace(localeHref("/auth/login?callbackUrl=%2Fsalons-for-sale%2Fnew"));
        return;
      }
      if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
        toast.error(tr("Chỉ tài khoản Chủ tiệm mới đăng được tin sang tiệm.", "Only salon owner accounts can list a salon for sale."));
        router.replace(localeHref("/salons-for-sale"));
        return;
      }
      // Điền sẵn từ hồ sơ (thị trường / bang / thành phố / SĐT) — vẫn sửa được
      const p = await fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (p) {
        const m: "US" | "AU" = p.market === "AU" ? "AU" : "US";
        const codes: readonly string[] = m === "AU" ? AU_ALL_CODES : US_ALL_CODES;
        setMarket(m);
        const st = String(p.state || "").trim().toUpperCase();
        setState(codes.includes(st) ? st : codes[0]);
        if (typeof p.city === "string" && p.city.trim() && p.city.trim() !== "—") setCity(p.city.trim().slice(0, 60));
        const pp = parseMarketPhone(p.phone, m);
        if (pp) setPhone(pp.display);
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const states = market === "US" ? US_ALL_CODES : AU_ALL_CODES;
  const uploading = photos.some((p) => !p.url && !p.error);
  const phoneMsg = marketPhoneError(market);
  const checkPhone = () => {
    const ok = parseMarketPhone(phone, market);
    setPhoneError(!ok);
    if (ok) setPhone(ok.display);
    return !!ok;
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length > room) toast(tr(`Tối đa ${MAX_PHOTOS} ảnh.`, `Up to ${MAX_PHOTOS} photos.`));
    const items: Photo[] = picked.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, preview: URL.createObjectURL(f), progress: 0 }));
    setPhotos((prev) => [...prev, ...items]);
    await Promise.all(
      picked.map(async (file, i) => {
        const key = items[i].key;
        try {
          const url = await uploadMedia(file, (pr) => setPhotos((prev) => prev.map((m) => (m.key === key ? { ...m, progress: pr } : m))));
          setPhotos((prev) => prev.map((m) => (m.key === key ? { ...m, url, progress: 100 } : m)));
        } catch (err) {
          setPhotos((prev) => prev.map((m) => (m.key === key ? { ...m, error: err instanceof Error ? err.message : tr("Tải thất bại", "Upload failed") } : m)));
        }
      }),
    );
    if (fileRef.current) fileRef.current.value = "";
  };

  const canSubmit = city.trim() && title.trim().length >= 4 && description.trim().length >= 20 && phone.trim() && !uploading && !submitting;
  const submit = async () => {
    if (!canSubmit) return;
    if (!checkPhone()) return toast.error(tr(phoneMsg.vi, phoneMsg.en));
    setSubmitting(true);
    const t = toast.loading(tr("Đang đăng tin…", "Posting…"));
    try {
      const r = await fetch("/api/salon-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, state, city, salonName, title, askingPrice, monthlyRent, monthlyRevenue, chairs, tables, sqft, description, phone, mediaUrls: photos.filter((p) => p.url).map((p) => p.url) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(apiError(d, "Không đăng được tin.", "Couldn't post the listing."), { id: t });
        return;
      }
      toast.success(tr("Đã đăng tin sang tiệm", "Your salon is listed"), { id: t });
      playSound("success");
      router.push(localeHref(`/salons-for-sale/${d.id}`));
    } catch {
      toast.error(tr("Lỗi mạng, thử lại.", "Network error. Try again."), { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col text-slate-100">
        <Navbar />
        <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-pink-500" /></main>
      </div>
    );
  }

  const money = (id: string, label: string, value: string, set: (v: string) => void, ph: string) => (
    <div className="min-w-0">
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} inputMode="numeric" value={value} onChange={(e) => set(e.target.value.replace(/[^\d,]/g, "").slice(0, 12))} placeholder={ph} className="input-field" />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-28 md:pb-10">
        <Link href="/salons-for-sale" className="mb-4 inline-flex min-h-[40px] items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> {tr("Sang tiệm nail", "Salons for sale")}
        </Link>
        <form className="glass-card space-y-6 rounded-2xl p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); submit(); }} data-sale-form>
          <div>
            <h1 className="text-lg font-black text-white">{tr("Đăng tin sang tiệm", "List your salon for sale")}</h1>
            <p className="mt-1 text-xs text-slate-400">{tr("Miễn phí. Người mua gọi hoặc nhắn tin thẳng cho bạn. Ghi càng rõ số liệu, càng nhiều người hỏi.", "Free. Buyers call or message you directly. The more numbers you share, the more serious buyers you get.")}</p>
          </div>

          <fieldset className="space-y-4 text-sm">
            <legend className="mb-2 text-sm font-bold text-slate-200">{tr("Tiệm ở đâu", "Location")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["US", "AU"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={market === m} onClick={() => { setMarket(m); setState((m === "US" ? US_ALL_CODES : AU_ALL_CODES)[0]); }} className={`min-h-[44px] rounded-xl font-bold ring-[1.5px] ${market === m ? "bg-white/[0.04] text-white ring-pink-400" : "text-slate-400 ring-white/10"}`}>
                  <span className="inline-flex items-center gap-1.5"><Flag code={m} /> {m === "US" ? tr("Mỹ (US)", "United States") : tr("Úc (AU)", "Australia")}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="sale-city" className="field-label">{tr("Thành phố *", "City *")}</label>
                <input id="sale-city" value={city} onChange={(e) => { setCity(e.target.value); const g = guessState(market, e.target.value); if (g && (states as readonly string[]).includes(g)) setState(g); }} placeholder={tr("VD: Indianapolis", "e.g. Indianapolis")} className="input-field" />
              </div>
              <div className="min-w-0">
                <label htmlFor="sale-state" className="field-label">{tr("Bang *", "State *")}</label>
                <select id="sale-state" value={state} onChange={(e) => setState(e.target.value)} className="input-field">
                  {states.map((c) => <option key={c} value={c}>{stateName(market, c)}</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4 text-sm">
            <legend className="mb-2 text-sm font-bold text-slate-200">{tr("Giá & số liệu", "Price & numbers")}</legend>
            <div>
              <label htmlFor="sale-title" className="field-label">{tr("Tiêu đề *", "Title *")}</label>
              <input id="sale-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={tr("VD: Sang tiệm 8 ghế, khu Mỹ trắng, khách quen đông", "e.g. 8-chair salon, busy plaza, loyal clients")} className="input-field" />
            </div>
            <div>
              <label htmlFor="sale-name" className="field-label">{tr("Tên tiệm (không bắt buộc)", "Salon name (optional)")}</label>
              <input id="sale-name" value={salonName} maxLength={60} onChange={(e) => setSalonName(e.target.value)} placeholder={tr("Để trống nếu muốn giữ kín", "Leave blank to keep it private")} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {money("sale-price", tr("Giá sang ($)", "Asking price ($)"), askingPrice, setAskingPrice, "120,000")}
              {money("sale-rent", tr("Tiền thuê / tháng", "Rent / month"), monthlyRent, setMonthlyRent, "1,950")}
              {money("sale-rev", tr("Doanh thu / tháng", "Revenue / month"), monthlyRevenue, setMonthlyRevenue, "40,000")}
              {money("sale-chairs", tr("Ghế spa", "Pedicure chairs"), chairs, setChairs, "8")}
              {money("sale-tables", tr("Bàn làm tay", "Nail tables"), tables, setTables, "8")}
              {money("sale-sqft", tr("Diện tích (sqft)", "Size (sqft)"), sqft, setSqft, "1,400")}
            </div>
            <p className="text-xs text-slate-500">{tr("Để trống giá sang nếu muốn thương lượng.", "Leave the asking price blank for price on request.")}</p>
          </fieldset>

          <fieldset className="space-y-4 text-sm">
            <legend className="mb-2 text-sm font-bold text-slate-200">{tr("Mô tả & liên hệ", "Details & contact")}</legend>
            <div>
              <label htmlFor="sale-desc" className="field-label">{tr("Mô tả tiệm *", "Description *")}</label>
              <textarea id="sale-desc" rows={5} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} placeholder={tr("Khu vực, loại khách, giờ mở cửa, hợp đồng thuê còn bao lâu, lý do sang, có để lại thợ / supply không…", "Area, clientele, hours, lease term left, reason for selling, whether staff and supplies stay…")} className="input-field resize-y" />
            </div>
            <div>
              <label htmlFor="sale-phone" className="field-label">{tr("Số điện thoại *", "Phone *")}</label>
              <input id="sale-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(false); }} onBlur={() => { if (phone.trim()) checkPhone(); }} placeholder={market === "AU" ? "0412 345 678" : "(317) 555-0123"} aria-invalid={phoneError || undefined} aria-describedby={phoneError ? "sale-phone-err" : undefined} className="input-field" />
              {phoneError && <p id="sale-phone-err" role="alert" className="mt-1.5 text-xs font-semibold text-rose-300">{tr(phoneMsg.vi, phoneMsg.en)}</p>}
            </div>
          </fieldset>

          <fieldset className="space-y-3 text-sm">
            <legend className="mb-1 text-sm font-bold text-slate-200">{tr("Ảnh tiệm (không bắt buộc)", "Salon photos (optional)")}</legend>
            <p className="text-xs text-slate-500">{tr(`Mặt tiền, ghế spa, bàn làm tay, bãi đậu xe… Tối đa ${MAX_PHOTOS} ảnh. Tin có ảnh được hỏi nhiều hơn hẳn.`, `Storefront, pedicure chairs, stations, parking… Up to ${MAX_PHOTOS} photos. Listings with photos get far more calls.`)}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((m) => (
                <div key={m.key} className="relative aspect-square overflow-hidden rounded-xl bg-slate-900 ring-1 ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.preview} alt="" className="h-full w-full object-cover" />
                  {!m.url && !m.error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-xs font-bold text-white"><Loader2 className="h-5 w-5 animate-spin" /> {m.progress}%</div>}
                  {m.error && <div className="absolute inset-0 flex items-center justify-center bg-red-950/80 p-2 text-center text-[10px] font-semibold text-red-200">{m.error}</div>}
                  <button type="button" onClick={() => setPhotos((prev) => prev.filter((x) => x.key !== m.key))} aria-label={tr("Xoá ảnh này", "Remove photo")} className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-4 w-4" /></button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-slate-400 hover:border-pink-500/60 hover:text-pink-300">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-[11px] font-bold">{tr("Thêm ảnh", "Add photo")}</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </fieldset>

          <button type="submit" disabled={!canSubmit} data-sale-submit className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 font-bold text-white transition-colors enabled:hover:bg-pn-brand-hover disabled:bg-pn-raised disabled:text-pn-text-3">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {uploading ? tr("Đang tải ảnh…", "Uploading photos…") : tr("Đăng tin sang tiệm", "Post listing")}
          </button>
          {!canSubmit && !submitting && !uploading && (
            <p className="-mt-3 text-center text-xs text-slate-500">{tr("Cần: thành phố, tiêu đề, mô tả (≥ 20 ký tự) và số điện thoại.", "Needed: city, title, description (20+ characters) and phone.")}</p>
          )}
        </form>
      </main>
    </div>
  );
}
