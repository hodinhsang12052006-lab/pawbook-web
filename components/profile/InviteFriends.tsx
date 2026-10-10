"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Copy, Megaphone, Share2, Users } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { tr } from "@/lib/i18n/tr";

interface RefData {
  link: string;
  count: number;
  ambassadorAt: number;
  recent: { id: string; name: string; avatarUrl: string | null; role: string }[];
}

// "Mời bạn bè" — link riêng, chia sẻ 1 chạm (Zalo/Messenger/SMS qua menu chia sẻ của máy),
// đếm số người đã tham gia nhờ mình, mời đủ → huy hiệu "Đại sứ PawNail" trên hồ sơ.
export default function InviteFriends() {
  const [d, setD] = useState<RefData | null>(null);
  useEffect(() => {
    fetch("/api/referrals").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
  }, []);
  if (!d) return <div className="h-40 animate-pulse rounded-xl bg-slate-950/50 ring-1 ring-white/10" />;

  const message = tr(
    "Mình đang dùng PawNail Jobs để tìm việc / tìm thợ nail — miễn phí, nhắn trực tiếp với tiệm. Vào thử nè:",
    "I'm using PawNail Jobs to find nail jobs / techs — free, message salons directly. Try it:",
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.link);
      toast.success(tr("Đã chép link mời", "Invite link copied"));
    } catch {
      toast.error(tr("Không chép được — giữ lâu vào link để chép", "Couldn't copy — long-press the link"));
    }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "PawNail Jobs", text: message, url: d.link }); } catch {}
      return;
    }
    copy();
  };
  const left = Math.max(0, d.ambassadorAt - d.count);
  const pct = Math.min(100, Math.round((d.count / d.ambassadorAt) * 100));

  return (
    <div className="space-y-3" data-testid="invite-friends">
      <div className="flex items-center gap-2 rounded-xl bg-slate-950/50 p-2 pl-3 ring-1 ring-white/10">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300" data-testid="invite-link">{d.link.replace(/^https?:\/\//, "")}</span>
        <button type="button" onClick={copy} aria-label={tr("Chép link", "Copy link")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10">
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={share} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-bold text-white shadow-lg shadow-pink-600/20 hover:brightness-110">
        <Share2 className="h-4 w-4" />{tr(" Gửi link cho bạn bè", " Send to friends")}
      </button>

      <div className="rounded-xl bg-slate-950/50 p-3.5 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Users className="h-4 w-4 text-pink-300" />
            <span data-testid="invite-count">{tr(`${d.count} người đã tham gia`, `${d.count} joined`)}</span>
          </p>
          {left === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-[11px] font-bold text-fuchsia-200 ring-1 ring-fuchsia-400/40"><Megaphone className="h-3.5 w-3.5" />{tr(" Đại sứ PawNail", " PawNail Ambassador")}</span>
          ) : (
            <span className="text-[11px] text-slate-400">{tr(`Còn ${left} người → huy hiệu Đại sứ`, `${left} more → Ambassador badge`)}</span>
          )}
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {d.recent.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {d.recent.map((u) => (
              <a key={u.id} href={`/profile/${u.id}`} className="flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-1 pr-2.5 text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/10">
                <Avatar src={u.avatarUrl} name={u.name} className="h-[22px] w-[22px] text-[9px]" />
                {u.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
