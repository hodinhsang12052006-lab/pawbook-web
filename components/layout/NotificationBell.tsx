"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Bell, Heart, MessageCircle, Star, Bookmark, Unlock, CheckCheck, Flame, Volume2, VolumeX } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { acquireUserChannel, releaseUserChannel } from "@/lib/pusherUserChannel";
import { getPusherClient } from "@/lib/pusherClient";
import { jobAlertChannelName } from "@/lib/pusherChannel";
import { playSound, getSoundPrefs, setSoundPrefs } from "@/lib/sounds";
import { timeAgo } from "@/lib/feedFormat";
import Avatar from "@/components/ui/Avatar";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface NotificationItem {
  id: string;
  kind: "like" | "comment" | "review" | "save" | "unlock" | "job";
  actor: { id: string | null; name: string; nameEn?: string; avatarUrl: string | null };
  text: string;
  textEn?: string;
  href: string;
  createdAt: string;
}

const KIND_STYLE: Record<NotificationItem["kind"], { icon: typeof Heart; cls: string }> = {
  like: { icon: Heart, cls: "bg-pink-500 text-white" },
  comment: { icon: MessageCircle, cls: "bg-sky-500 text-white" },
  review: { icon: Star, cls: "bg-amber-500 text-white" },
  save: { icon: Bookmark, cls: "bg-emerald-500 text-white" },
  unlock: { icon: Unlock, cls: "bg-violet-500 text-white" },
  job: { icon: Flame, cls: "bg-gradient-to-br from-orange-500 to-red-500 text-white" },
};

// Mốc "đã xem thông báo" lưu theo user trên thiết bị (không cần bảng DB mới).
const seenKey = (uid: string) => `pn_notif_seen_${uid}`;
function readSeen(uid: string): number {
  try {
    return Number(localStorage.getItem(seenKey(uid)) || 0);
  } catch {
    return 0;
  }
}

export default function NotificationBell() {
  useTr(); // render lại khi đổi VI/EN
  const { user } = useSessionUser();
  const uid: string | undefined = user?.id;
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  // Tắt/bật tiếng nhanh ngay trong bảng thông báo (đồng bộ với Cài đặt âm thanh).
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    setSoundOn(getSoundPrefs().enabled);
    const onChange = (e: Event) => setSoundOn((e as CustomEvent<{ enabled: boolean }>).detail.enabled);
    window.addEventListener("sound-prefs-change", onChange);
    return () => window.removeEventListener("sound-prefs-change", onChange);
  }, []);
  const [seenAt, setSeenAt] = useState(0);
  // Mốc đã xem TRƯỚC lần mở hiện tại — để vẫn tô sáng các mục mới trong
  // lúc panel đang mở (sau khi đã đánh dấu đã đọc).
  const [highlightBefore, setHighlightBefore] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!uid) return;
    setSeenAt(readSeen(uid));
    load();
  }, [uid, load]);

  // Realtime: server bắn "notification" khi có người thích / bình luận /
  // đánh giá / lưu tin / mở khoá liên hệ → tải lại danh sách + báo nhẹ.
  useEffect(() => {
    if (!uid) return;
    const channel = acquireUserChannel(uid);
    if (!channel) return;
    const onNotify = (data: { text?: string; textEn?: string }) => {
      load();
      playSound("notify");
      if (data?.text) toast(tr(data.text, data.textEn || data.text), { icon: "🔔", position: "top-right" });
    };
    channel.bind("notification", onNotify);
    return () => {
      channel.unbind("notification", onNotify);
      releaseUserChannel(uid);
    };
  }, [uid, load]);

  // Thợ: nghe kênh công khai "việc gấp" của bang mình — tiệm vừa đăng tin
  // gấp là chuông kêu ngay, ai thấy trước liên hệ trước.
  const alertChannel = user?.role === "TECHNICIAN" && user?.market && user?.state ? jobAlertChannelName(user.market, user.state) : null;
  useEffect(() => {
    if (!alertChannel) return;
    const pusher = getPusherClient();
    if (!pusher) return;
    const channel = pusher.subscribe(alertChannel);
    const onJob = (data: { id?: string; text?: string; textEn?: string }) => {
      load();
      playSound("urgent");
      if (data?.text) {
        toast(
          (t) => (
            <Link href={`/jobs/${data.id}`} onClick={() => toast.dismiss(t.id)} className="block">
              <span className="block text-[11px] font-black uppercase tracking-wider text-orange-300">{tr("Việc gấp gần bạn", "Urgent job near you")}</span>
              <span className="block">{tr(data.text ?? "", data.textEn || data.text || "")}</span>
            </Link>
          ),
          { icon: "🔥", position: "top-right", duration: 7000 }
        );
      }
    };
    channel.bind("urgent-job", onJob);
    return () => {
      channel.unbind("urgent-job", onJob);
      pusher.unsubscribe(alertChannel);
    };
  }, [alertChannel, load]);

  // Đóng khi bấm ra ngoài / phím Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!uid) return null;

  const unread = (items || []).filter((i) => new Date(i.createdAt).getTime() > seenAt).length;

  const markAllRead = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(seenKey(uid), String(now));
    } catch {}
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setHighlightBefore(seenAt);
      load();
      markAllRead();
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? tr(`Thông báo, ${unread} chưa đọc`, `Notifications, ${unread} unread`) : "Thông báo"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
      >
        <Bell className={`h-[18px] w-[18px] ${unread > 0 ? "text-pink-300" : ""}`} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-slate-950 bg-gradient-to-r from-pink-600 to-fuchsia-600 px-1 text-[9px] font-black leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className="fixed inset-x-2 top-16 z-[60] max-h-[75vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020] shadow-2xl shadow-black/70 animate-scaleUp sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <p className="text-sm font-black text-white">Thông báo</p>
            <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const next = setSoundPrefs({ enabled: !soundOn });
                if (next.enabled) playSound("notify", { force: true });
              }}
              aria-label={soundOn ? tr("Tắt âm thanh", "Mute sounds") : tr("Bật âm thanh", "Unmute sounds")}
              title={soundOn ? tr("Tắt âm thanh", "Mute sounds") : tr("Bật âm thanh", "Unmute sounds")}
              className={`rounded-lg p-1.5 transition-colors hover:bg-white/10 ${soundOn ? "text-slate-300" : "text-slate-600"}`}
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-semibold text-pink-300 hover:text-pink-200">
              <CheckCheck className="h-3.5 w-3.5" />{tr(" Đánh dấu đã đọc", " Mark all read")}
            </button>
            </div>
          </div>

          <div className="max-h-[calc(75vh-48px)] overflow-y-auto custom-scrollbar p-1.5">
            {items === null &&
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton m-1.5 h-14" />)}
            {items?.length === 0 && (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-200">{tr("Chưa có thông báo", "No notifications yet")}</p>
                <p className="mt-1 text-xs text-slate-500">{tr("Khi có người thích, bình luận hay đánh giá bạn, thông báo sẽ hiện ở đây.", "When someone likes, comments on or reviews you, it shows up here.")}</p>
              </div>
            )}
            {items?.map((n) => {
              const { icon: Icon, cls } = KIND_STYLE[n.kind];
              const isNew = new Date(n.createdAt).getTime() > highlightBefore;
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5 ${isNew ? "bg-pink-500/[0.07]" : ""}`}
                >
                  <span className="relative flex-shrink-0">
                    <Avatar src={n.actor.avatarUrl} name={n.actor.name} seed={n.actor.id} alt="" className="h-10 w-10 ring-1 ring-white/10" />
                    <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-slate-950 ${cls}`}>
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug text-slate-300">
                      <span className="font-bold text-white">{n.actor.nameEn ? tr(n.actor.name, n.actor.nameEn) : n.actor.name}</span> {tr(n.text, n.textEn || n.text)}
                    </span>
                    <span className={`mt-0.5 block text-[11px] ${isNew ? "font-semibold text-pink-300" : "text-slate-500"}`}>{timeAgo(n.createdAt)}</span>
                  </span>
                  {isNew && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-pink-500" aria-label={tr("Mới", "New")} />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
