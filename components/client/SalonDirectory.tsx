"use client";

// "Tiệm & thợ quanh bạn" — khách chọn chỗ làm móng bằng 3 thứ họ thật sự nhìn (học từ Booksy / StyleSeat):
// ẢNH tác phẩm thật → GIÁ dịch vụ → ĐÁNH GIÁ của khách thật. Bấm thẻ → menu + đặt lịch; nút Nhắn tin hỏi mẫu.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle, Share2, Star, Store, Sparkles, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import Avatar from "@/components/ui/Avatar";
import { cdnImage } from "@/lib/cdnImage";
import { stateName } from "@/lib/stateNames";
import { currentLocale, tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { menuText } from "@/lib/menu";
import { detectTextLang } from "@/lib/i18n/detectLang";

export interface SalonItem {
  id: string; name: string; avatarUrl: string | null; kind: "salon" | "tech"; state: string | null; city: string | null; local: boolean;
  photos: string[]; services: { name: string; nameEn?: string | null; nameVi?: string | null; enOrigin?: "mt" | "owner" | "design" | null; priceFrom: number; priceTo: number | null }[]; skills: string[]; rating: number | null; reviews: number;
}

const price = (s: { priceFrom: number; priceTo: number | null }) => `$${s.priceFrom}${s.priceTo && s.priceTo > s.priceFrom ? `–${s.priceTo}` : "+"}`;

export function SalonCard({ s, market }: { s: SalonItem; market: "US" | "AU" }) {
  useTr();
  const where = [s.city, stateName(market, s.state)].filter(Boolean).join(", ");
  return (
    <article className="overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10 transition hover:ring-pink-400/40">
      <Link href={`/menu/${s.id}`} className="block">
        {s.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5 bg-black/30">
            {s.photos.slice(0, 3).map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={cdnImage(u, 360)} alt="" loading="lazy" className={`aspect-square w-full object-cover ${i === 0 && s.photos.length < 3 ? "col-span-3 aspect-[3/1]" : ""}`} />
            ))}
          </div>
        ) : (
          <div className="flex aspect-[3/1] items-center justify-center bg-gradient-to-br from-pink-500/15 to-violet-500/10">
            <Sparkles className="h-6 w-6 text-pink-300/70" />
          </div>
        )}
        <div className="flex items-start gap-3 p-4">
          <Avatar src={s.avatarUrl} name={s.name} seed={s.id} className="h-11 w-11 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[15px] font-black text-white">
              {s.kind === "salon" && <Store className="h-4 w-4 flex-shrink-0 text-amber-300" />}{s.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400"><MapPin className="h-3.5 w-3.5 flex-shrink-0" />{where || tr("Chưa ghi khu vực", "Area not listed")}</p>
            {s.rating !== null ? (
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-300"><Star className="h-3.5 w-3.5 fill-amber-300" />{s.rating.toFixed(1)}<span className="font-semibold text-slate-500">· {s.reviews} {tr("đánh giá", s.reviews === 1 ? "review" : "reviews")}</span></p>
            ) : (
              <p className="mt-1 text-xs font-semibold text-emerald-300/90">{s.kind === "salon" ? tr("Tiệm mới trên PawNail", "New on PawNail") : tr("Thợ mới trên PawNail", "New on PawNail")}</p>
            )}
          </div>
        </div>
        {s.services.length > 0 && (
          <ul className="space-y-1 border-t border-white/5 px-4 py-3">
            {s.services.map((sv) => {
              const t = menuText({ ...sv, description: null }, currentLocale());
              return (
              <li key={sv.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-200" lang={detectTextLang(t.name) ?? undefined} title={t.machine ? tr(`Dịch máy · bản gốc: ${t.originalName}`, `Machine-translated · original: ${t.originalName}`) : undefined}>{t.name}</span>
                <span className="flex-shrink-0 font-bold text-emerald-300">{price(sv)}</span>
              </li>
              );
            })}
          </ul>
        )}
      </Link>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <Link href={`/menu/${s.id}`} className="flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 text-sm font-black text-white">{tr("Menu & đặt lịch", "Menu & booking")}</Link>
        <Link href={`/messages?to=${s.id}`} className="flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-white/10"><MessageCircle className="h-4 w-4" />{tr("Nhắn tin", "Message")}</Link>
      </div>
    </article>
  );
}

/**
 * compact: the guest landing — 2 columns from lg, and only the first `phoneLimit` cards on phones (< 640 px), where
 * 4 near-identical 3-photo cards made the page ~10,000 px tall; the landing adds a "See all salons" link below.
 */
export default function SalonDirectory({ market = "US", state = "", limit = 24, compact = false, phoneLimit }: { market?: "US" | "AU"; state?: string; limit?: number; compact?: boolean; phoneLimit?: number }) {
  useTr();
  const [items, setItems] = useState<SalonItem[] | null>(null);
  // Mời tiệm quen: điện thoại → bảng chia sẻ (Zalo, Messenger, iMessage…); máy không hỗ trợ → chép lời mời để dán
  const invite = async () => {
    const url = `${window.location.origin}/auth/register?role=owner`;
    const text = tr("Tiệm mình lên PawNail nhé — khách xem menu, thử mẫu trên tay rồi gửi yêu cầu đặt lịch ngay trong app. PawNail không thu phí tiệm:", "Join PawNail — clients can see your menu, try looks on their hand and request a booking in the app. PawNail doesn't charge salons:");
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: "PawNail", text, url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast.success(tr("Đã chép lời mời — dán gửi tiệm qua Zalo / Messenger.", "Invite copied — paste it to your salon.")); }
    catch { toast(url); }
  };
  useEffect(() => {
    let off = false;
    fetch(`/api/salons?market=${market}&state=${encodeURIComponent(state)}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => { if (!off) setItems(Array.isArray(d.items) ? d.items : []); })
      .catch(() => { if (!off) setItems([]); });
    return () => { off = true; };
  }, [market, state, limit]);

  const cols = compact ? "lg:grid-cols-2" : "sm:grid-cols-2";
  if (items === null) return <div className={`grid gap-3 ${cols}`}>{Array.from({ length: compact ? 2 : 4 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-3xl bg-white/[0.04]" />)}</div>;
  if (!items.length) {
    // Nói THẬT (chưa có tiệm nào lên menu ở đây) + 2 việc khách làm được ngay — không hứa "sẽ báo" khi chưa có
    return (
      <div className="rounded-3xl bg-white/[0.03] p-5 text-center ring-1 ring-white/10" data-testid="salons-empty">
        <Store className="mx-auto h-8 w-8 text-pink-300/70" />
        <p className="mt-2 text-sm font-bold text-white">{state ? tr(`Chưa có tiệm tại ${stateName(market, state)} đăng menu trên PawNail.`, `No salons in ${stateName(market, state)} have a menu on PawNail yet.`) : tr("Các tiệm đang thiết lập menu dịch vụ.", "Salons are still setting up their menus.")}</p>
        <p className="mt-1 text-xs text-slate-400">{tr("Trong lúc chờ, bạn có thể thử mẫu, lưu mẫu yêu thích hoặc mời tiệm quen tham gia.", "In the meantime, try on looks and save your favorites, or invite your salon.")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/tryon" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-xs font-black text-white"><Wand2 className="h-4 w-4" />{tr("Thử mẫu trên tay", "Try on my hand")}</Link>
          <button type="button" onClick={invite} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-xs font-bold text-slate-200 ring-1 ring-white/10"><Share2 className="h-4 w-4" />{tr("Mời tiệm quen", "Invite my salon")}</button>
        </div>
      </div>
    );
  }
  const hasLocal = items.some((i) => i.local);
  return (
    <div className="space-y-3">
      {state && !hasLocal && <p className="text-xs text-slate-400">{tr(`Chưa có tiệm tại ${stateName(market, state)} đăng menu — tiệm ở nơi khác:`, `No salons in ${stateName(market, state)} yet. Salons elsewhere:`)}</p>}
      <div className={`grid gap-3 ${cols}`}>
        {items.map((s, i) => (
          <div key={s.id} className={phoneLimit != null && i >= phoneLimit ? "max-sm:hidden" : undefined}>
            <SalonCard s={s} market={market} />
          </div>
        ))}
      </div>
    </div>
  );
}
