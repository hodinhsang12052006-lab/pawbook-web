"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { cdnImage } from "@/lib/cdnImage";
import { priceLabel, type PublicMenuItem } from "@/lib/menu";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

type Item = PublicMenuItem & { owner: { id: string; name: string | null; avatarUrl: string | null; city: string | null } };

// Ảnh THẬT kèm giá từ menu của thợ / tiệm — đặt trước ý tưởng AI. Chưa có mẫu nào thì ẩn hẳn.
export default function MenuShowcase() {
  useTr();
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    fetch("/api/menu/showcase?limit=12").then((r) => (r.ok ? r.json() : null)).then((j) => setItems(j?.items ?? [])).catch(() => {});
  }, []);
  if (!items.length) return null;
  return (
    <section aria-label={tr("Menu có giá từ thợ", "Priced menus from techs")} className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-base font-black text-white"><BookOpen className="h-4 w-4 text-amber-300" />{tr("Menu có giá từ thợ", "Priced menus from techs")}</h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {items.map((it) => (
          <Link key={it.id} href={`/menu/${it.owner.id}`} className="w-40 flex-shrink-0 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10 transition-colors hover:ring-white/25">
            <div className="aspect-square bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cdnImage(it.images[0], 320)} alt={it.name} loading="lazy" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-1 p-2.5">
              <p className="line-clamp-1 text-[13px] font-bold text-white">{it.name}</p>
              <p className="text-sm font-black text-emerald-300">{priceLabel(it.priceFrom, it.priceTo)}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Avatar src={it.owner.avatarUrl} name={it.owner.name} seed={it.owner.id} className="h-4 w-4" alt="" />
                <span className="truncate">{it.owner.name}{it.owner.city ? ` · ${it.owner.city}` : ""}</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
