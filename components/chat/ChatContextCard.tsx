"use client";

// Thẻ đầu cuộc trò chuyện KHÁCH ↔ TIỆM / THỢ — biến lời "hello" thành đơn làm móng:
//  • Khách đang nhắn tiệm/thợ → hiện ngay menu có ẢNH + GIÁ của tiệm (khỏi hỏi "giá sao ạ?") + nút đặt lịch.
//  • Tiệm/thợ đang nhắn khách → gợi ý ✨ Tạo mẫu trên tay khách (Thử mẫu PawNail) + gửi link menu 1 chạm.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarCheck, Sparkles } from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface Item { id: string; name: string; priceFrom: number; priceTo: number | null; images: string[] }
const PRO = new Set(["TECHNICIAN", "OWNER"]);

export default function ChatContextCard({ meRole, meId, partner, onStudio, onSendText }: {
  meRole: string | null | undefined;
  meId: string;
  partner: { id: string; name: string; role: string; isGroup: boolean };
  onStudio: () => void;
  onSendText: (text: string) => void;
}) {
  useTr();
  const clientToPro = meRole === "CLIENT" && PRO.has(partner.role) && !partner.isGroup;
  const proToClient = PRO.has(meRole || "") && partner.role === "CLIENT" && !partner.isGroup;
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    if (!clientToPro) return;
    let off = false;
    fetch(`/api/menu?userId=${encodeURIComponent(partner.id)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (!off) setItems((Array.isArray(d.items) ? d.items : []).slice(0, 4)); })
      .catch(() => { if (!off) setItems([]); });
    return () => { off = true; };
  }, [clientToPro, partner.id]);

  if (clientToPro) {
    if (!items) return null;
    return (
      <section className="mx-auto mb-3 w-full max-w-md rounded-3xl bg-slate-950/70 p-3.5 ring-1 ring-white/10 backdrop-blur" aria-label={tr("Menu của tiệm", "Salon menu")}>
        <p className="flex items-center gap-1.5 text-xs font-black text-pink-200"><BookOpen className="h-4 w-4" />{tr(`Menu & mẫu của ${partner.name}`, `${partner.name}'s menu & looks`)}</p>
        {items.length > 0 ? (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {items.map((it) => (
              <Link key={it.id} href={`/menu/${partner.id}`} className="overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
                {it.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cdnImage(it.images[0], 320)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                ) : <span className="flex aspect-square items-center justify-center bg-pink-500/10"><Sparkles className="h-5 w-5 text-pink-300" /></span>}
                <span className="block px-2 py-1.5">
                  <span className="block truncate text-[12px] font-bold text-white">{it.name}</span>
                  <span className="block text-[11px] font-bold text-emerald-300">${it.priceFrom}{it.priceTo && it.priceTo > it.priceFrom ? `–${it.priceTo}` : "+"}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-slate-400">{tr("Gửi ảnh mẫu bạn thích + ảnh tay của bạn — tiệm sẽ báo giá và gửi mẫu thử trên tay bạn.", "Send a photo of the look you want + your hand — they'll quote and send try-on previews.")}</p>
        )}
        <Link href={`/menu/${partner.id}`} className="mt-2.5 flex min-h-[40px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white"><CalendarCheck className="h-4 w-4" />{tr("Xem menu & đặt lịch", "Menu & book")}</Link>
      </section>
    );
  }

  if (proToClient) {
    const menuUrl = typeof window !== "undefined" ? `${window.location.origin}/menu/${meId}` : `/menu/${meId}`;
    return (
      <section className="mx-auto mb-3 w-full max-w-md rounded-3xl bg-gradient-to-br from-pink-500/15 to-violet-500/10 p-3.5 ring-1 ring-pink-400/25" aria-label={tr("Gợi ý bán hàng", "Sales tips")}>
        <p className="text-xs font-black text-pink-100">{tr("💅 Đây là khách làm nail — chốt đơn nhanh:", "💅 This is a nail client — close faster:")}</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onStudio} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-[13px] font-black text-white"><Sparkles className="h-4 w-4" />{tr("Tạo mẫu trên tay", "Try-on looks")}</button>
          <button type="button" onClick={() => onSendText(tr(`Menu & bảng giá bên em đây ạ, chị/anh xem và đặt lịch luôn nhé: ${menuUrl}`, `Here's our menu & prices — you can book right there: ${menuUrl}`))} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.08] text-[13px] font-bold text-white ring-1 ring-white/15"><BookOpen className="h-4 w-4" />{tr("Gửi menu", "Send menu")}</button>
        </div>
        <p className="mt-2 text-[11px] text-pink-100/70">{tr("Mẹo: nhờ khách gửi 1 ảnh mu bàn tay → bấm Tạo mẫu → gửi 5–10 mẫu thử kèm giá.", "Tip: ask for a photo of the back of their hand → Try-on → send 5–10 looks with prices.")}</p>
      </section>
    );
  }
  return null;
}
