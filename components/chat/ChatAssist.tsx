"use client";

// TRỢ LÝ PAWNAIL ngay trên ô nhập tin — chạy đều cho cả 2 phía của 1 cuộc trò chuyện khách ↔ tiệm / thợ:
//  • THỢ / TIỆM: đọc tin khách CHƯA trả lời (hỏi giá, hỏi lịch, gửi ảnh mẫu, hỏi địa chỉ…) → 1–3 câu trả lời gợi ý,
//    giá lấy thật từ menu của chính thợ, đúng ngôn ngữ khách. Bấm → câu điền sẵn vào ô nhập (sửa được rồi mới gửi).
//    Khách gửi ảnh → Vẽ thử mẫu lên tay khách / Soi tay tư vấn ngay trên ảnh đó.
//  • KHÁCH: Menu & đặt lịch · Thử mẫu trên tay rồi gửi tiệm · Gửi ảnh tay để thợ tư vấn.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Camera, Sparkles, Wand2 } from "lucide-react";
import { hireSuggestions, proSuggestions, type MenuLite, type Suggestion } from "@/lib/chatAssist";
import { useSessionUser } from "@/lib/SessionUserContext";
import { currentLocale, tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

const PRO = new Set(["TECHNICIAN", "OWNER"]);

export default function ChatAssist({ me, partner, last, onFill, onStudio, onConsult, onPhoto }: {
  me: { id: string; role: string; market?: string | null };
  partner: { id: string; role: string; isGroup: boolean };
  /** tin khách gửi mà thợ CHƯA trả lời (null: đã trả lời / chưa có tin) */
  last: { content: string; type: string } | null;
  onFill: (text: string) => void;
  onStudio: () => void;
  onConsult: (image: string | null) => void;
  onPhoto: () => void;
}) {
  useTr();
  const loc = currentLocale();
  const proSide = PRO.has(me.role) && partner.role === "CLIENT" && !partner.isGroup;
  const clientSide = me.role === "CLIENT" && PRO.has(partner.role) && !partner.isGroup;
  // chat TUYỂN THỢ: chủ tiệm ↔ thợ — số liệu từ hồ sơ / tin tuyển của chính mình (đã nạp sẵn trong SessionUser)
  const hireSide = !partner.isGroup && ((me.role === "OWNER" && partner.role === "TECHNICIAN") || (me.role === "TECHNICIAN" && partner.role === "OWNER"));
  const { user: profile } = useSessionUser();
  const [menu, setMenu] = useState<MenuLite[] | null>(null);
  useEffect(() => {
    if (!proSide) return;
    let off = false;
    fetch(`/api/menu?userId=${encodeURIComponent(me.id)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      // thợ đang xem menu của mình → API trả cả món đang ẩn; gợi ý giá chỉ lấy món khách đang thấy
      .then((d) => { if (!off) setMenu((Array.isArray(d.items) ? d.items : []).filter((i: { active?: boolean }) => i.active !== false).map((i: MenuLite) => ({ name: i.name, priceFrom: Number(i.priceFrom) || 0, priceTo: i.priceTo == null ? null : Number(i.priceTo) }))); })
      .catch(() => { if (!off) setMenu([]); });
    return () => { off = true; };
  }, [proSide, me.id]);

  const lastContent = last?.content ?? null, lastType = last?.type ?? null;
  const suggestions: Suggestion[] = useMemo(() => {
    if (!proSide || menu === null) return [];
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.bitpawos.com";
    const msg = lastContent === null || lastType === null ? null : { content: lastContent, type: lastType };
    return proSuggestions(msg, { market: me.market === "AU" ? "AU" : "US", menu, menuUrl: `${origin}/menu/${me.id}`, fallbackVi: loc === "vi" });
  }, [proSide, menu, lastContent, lastType, me.market, me.id, loc]);

  const base = "flex min-h-[34px] flex-shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-bold ring-1 transition-colors";
  const chip = `${base} text-pink-100 ring-pink-400/25 hover:bg-pink-500/15`;

  const hire: Suggestion[] = useMemo(() => {
    // chờ hồ sơ (kỹ năng, tin tuyển) nạp xong — không thì thoáng hiện câu chung chung rồi mới đổi
    if (!hireSide || profile?.id !== me.id) return [];
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.bitpawos.com";
    const msg = lastContent === null || lastType === null ? null : { content: lastContent, type: lastType };
    const p = profile?.id === me.id ? profile : null;
    const job = Array.isArray(p?.jobs) && p.jobs.length ? p.jobs[0] : null;
    const tp = p?.technicianProfile;
    return hireSuggestions(msg, {
      side: me.role === "OWNER" ? "owner" : "tech",
      city: p?.city ?? tp?.city, state: p?.state ?? tp?.state,
      job: job ? { title: job.title, salaryType: job.salaryType, salaryAmount: job.salaryAmount, benefits: job.benefits } : null,
      turn: p?.turnSplitPolicy || null, housing: !!p?.housingSupport,
      skills: String(tp?.specialties || "").split(",").map((x: string) => x.trim()).filter(Boolean),
      years: Number(tp?.yearsOfExperience) || 0, profileUrl: `${origin}/profile/${me.id}`,
      fallbackVi: loc === "vi",
    });
  }, [hireSide, profile, me.id, me.role, lastContent, lastType, loc]);

  if (hireSide && hire.length) {
    return (
      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]" data-testid="chat-assist" aria-label={tr("Trợ lý PawNail — gợi ý trả lời", "PawNail assistant — reply suggestions")}>
        <span className="flex flex-shrink-0 items-center gap-1 pr-0.5 text-[10px] font-black uppercase tracking-wider text-pink-300/80"><Sparkles className="h-3.5 w-3.5" />{tr("Gợi ý", "Suggest")}</span>
        {hire.map((s) => (
          <button key={s.label} type="button" className={chip} title={s.text} onClick={() => onFill(s.text)}>{s.label}</button>
        ))}
      </div>
    );
  }

  if (proSide && suggestions.length) {
    return (
      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]" data-testid="chat-assist" aria-label={tr("Trợ lý PawNail — gợi ý trả lời", "PawNail assistant — reply suggestions")}>
        <span className="flex flex-shrink-0 items-center gap-1 pr-0.5 text-[10px] font-black uppercase tracking-wider text-pink-300/80"><Sparkles className="h-3.5 w-3.5" />{tr("Gợi ý", "Suggest")}</span>
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            className={chip}
            title={s.text}
            onClick={() => (s.action === "studio" ? onStudio() : s.action === "consult" ? onConsult(last?.type === "IMAGE" ? last.content : null) : onFill(s.text))}
          >
            {s.label}
          </button>
        ))}
        {menu !== null && !menu.some((m) => m.priceFrom > 0) && (
          // chưa có menu giá → trợ lý không báo giá được: mời thêm (giá thật, không bịa)
          <Link href={`/profile/${me.id}?tab=menu`} className={`${base} text-amber-200 ring-amber-400/30 hover:bg-amber-500/15`} data-testid="chat-assist-add-menu">
            <BookOpen className="h-3.5 w-3.5" />{tr("＋ Thêm menu giá để báo giá nhanh", "＋ Add prices to quote faster")}
          </Link>
        )}
      </div>
    );
  }
  if (clientSide) {
    return (
      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]" data-testid="chat-assist" aria-label={tr("Lối tắt cho khách", "Client shortcuts")}>
        <Link href={`/menu/${partner.id}`} className={chip}><BookOpen className="h-3.5 w-3.5" />{tr("Menu & đặt lịch", "Menu & booking")}</Link>
        <button type="button" className={chip} onClick={onStudio}><Wand2 className="h-3.5 w-3.5" />{tr("Thử mẫu trên tay & gửi tiệm", "Try looks on my hand")}</button>
        <button type="button" className={chip} onClick={onPhoto}><Camera className="h-3.5 w-3.5" />{tr("Gửi ảnh tay để tư vấn", "Send a hand photo")}</button>
      </div>
    );
  }
  return null;
}
