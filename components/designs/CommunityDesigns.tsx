"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Heart, Images, Plus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useSessionUser } from "@/lib/SessionUserContext";
import { tr } from "@/lib/i18n/tr";

interface Item {
  id: string; image: string; count: number; caption: string; likes: number; city: string | null;
  author: { id: string; name: string; avatarUrl: string | null; role: string };
}

// Ảnh THẬT thợ & tiệm đăng (bài "Khoe tay nghề" có ảnh) — hiện ngay ở trang Mẫu nail, không cần duyệt.
export default function CommunityDesigns() {
  const router = useRouter();
  const { user } = useSessionUser();
  const [items, setItems] = useState<Item[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/designs/community?limit=12").then((r) => (r.ok ? r.json() : null)).then((j) => { setItems(j?.items ?? []); setHasMore(!!j?.hasMore); }).catch(() => setItems([]));
  }, []);
  const more = () => {
    if (!items || busy) return;
    setBusy(true);
    fetch(`/api/designs/community?limit=12&offset=${items.length}`).then((r) => r.json()).then((j) => { setItems((l) => [...(l ?? []), ...(j.items ?? [])]); setHasMore(!!j.hasMore); }).finally(() => setBusy(false));
  };
  const post = () => {
    if (!user) { router.push("/auth/register"); return; }
    try { sessionStorage.setItem("pn_compose", "1"); sessionStorage.setItem("pn_compose_type", "SHOWCASE"); } catch {}
    router.push("/?tab=feed");
  };

  return (
    <section className="space-y-3" aria-labelledby="community-designs" data-testid="community-designs">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="community-designs" className="flex items-center gap-2 text-base font-black text-white"><Camera className="h-4 w-4 text-pink-300" />{tr("Ảnh thật từ thợ & tiệm", "Real work from techs & salons")}</h2>
          <p className="text-xs text-slate-400">{tr("Bài “Khoe tay nghề” có ảnh tự hiện ở đây — tiệm đang tìm thợ cũng xem mục này.", "Showcase posts with photos appear here — salons hiring browse this too.")}</p>
        </div>
        <button type="button" onClick={post} className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-3.5 text-xs font-bold text-white shadow-lg shadow-pink-600/20">
          <Plus className="h-4 w-4" />{tr("Đăng mẫu của bạn", "Post your work")}
        </button>
      </div>

      {items === null ? (
        <div className="flex gap-3 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-square w-40 shrink-0 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
      ) : items.length === 0 ? (
        <button type="button" onClick={post} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 p-4 text-left hover:border-pink-400/40">
          <Images className="h-8 w-8 shrink-0 text-pink-300" />
          <span>
            <span className="block text-sm font-bold text-white">{tr("Khoe ảnh thật tay nghề của bạn", "Show off your real work")}</span>
            <span className="block text-xs text-slate-400">{tr("Tiệm đang tìm thợ lướt mục này mỗi ngày — ảnh đẹp là lời mời việc nhanh nhất.", "Salons hiring browse this every day — great photos get you offers fastest.")}</span>
          </span>
        </button>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {items.map((it) => (
            <Link key={it.id} href={`/profile/${it.author.id}`} className="group w-40 shrink-0 snap-start sm:w-48">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image} alt={it.caption || tr(`Mẫu nail của ${it.author.name}`, `Nail work by ${it.author.name}`)} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                {it.count > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">+{it.count - 1}</span>}
                {it.likes > 0 && <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white"><Heart className="h-3 w-3 fill-pink-400 text-pink-400" />{it.likes}</span>}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Avatar src={it.author.avatarUrl} name={it.author.name} className="h-5 w-5 text-[8px]" />
                <span className="min-w-0 truncate text-xs font-semibold text-slate-200">{it.author.name}</span>
              </div>
              {it.city && <p className="truncate pl-6 text-[11px] text-slate-500">{it.city}</p>}
            </Link>
          ))}
          {hasMore && (
            <button type="button" onClick={more} disabled={busy} className="flex aspect-square w-32 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-xs font-bold text-slate-300 ring-1 ring-white/10 disabled:opacity-50">
              {busy ? tr("Đang tải…", "Loading…") : tr("Xem thêm", "More")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
