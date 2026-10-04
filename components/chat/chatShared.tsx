"use client";

// Hằng số, kiểu dữ liệu và component nhỏ dùng chung cho trang Tin nhắn —
// tách khỏi MessagesContent.tsx (file chính quá dài).
import React from "react";
import { useIsOnline } from "@/lib/presence";

export const POPULAR_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
  "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗",
  "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯",
  "✍️", "👍", "👎", "👊", "✊", "🤛", "🤜", "🤝", "👏", "🙌",
  "👐", "🤲", "🙏", "💅", "🤳", "💪", "🦾", "🦿", "❤️", "🧡",
  "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "🔥", "✨",
];

export const MOCK_STICKERS = [
  { emoji: "🐶", label: "Cún Cười" },
  { emoji: "🐱", label: "Mèo Wow" },
  { emoji: "🚀", label: "Thăng Tiến" },
  { emoji: "💎", label: "VIP Deal" },
  { emoji: "💼", label: "Duyệt Công" },
  { emoji: "🚗", label: "Vận Chuyển" },
  { emoji: "🛠️", label: "Đang Tới" },
  { emoji: "🔥", label: "Hot Deal" },
  { emoji: "🎉", label: "Chốt Deal" },
  { emoji: "👍", label: "Cực Tốt" },
];

export interface UserType {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isInternal?: boolean;
  lastActiveAt?: string | null;
}

export interface MessageType {
  id: string;
  content: string;
  type: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender?: { id: string; name: string; avatarUrl: string | null; role: string };
  receiver?: { id: string; name: string; avatarUrl: string | null; role: string };
  conversationId: string;
  isOptimistic?: boolean;
  sendError?: boolean;
}

// Bỏ dấu tiếng Việt để tìm "nguyen" ra "Nguyễn".
export const foldVi = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

// Giờ hiển thị kiểu Messenger/Zalo: hôm nay → 14:05 · trong tuần → T3 · cũ hơn → 12/09.
export function shortChatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 7) return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

// Avatar có chấm xanh khi người đó THẬT SỰ đang mở app (Pusher presence).
export function PresenceAvatar({ userId, src, alt, size = "h-11 w-11" }: { userId: string; src: string; alt: string; size?: string }) {
  const online = useIsOnline(userId);
  return (
    <span className={`relative ${size} flex-shrink-0`}>
      <img src={src} alt={alt} loading="lazy" className={`${size} rounded-full object-cover ring-1 ring-white/10`} />
      {online && (
        <span aria-label="Đang hoạt động" className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
      )}
    </span>
  );
}

// 3 chấm nhảy "đang soạn tin".
export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden>
      <span className="typing-dot" />
      <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
      <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
    </span>
  );
}

// "missed:audio" | "declined:video" | "ended:audio:125" → mô tả hiển thị.
export function describeCall(body: string) {
  const [outcome, kind, secs] = body.split(":");
  const label = kind === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";
  if (outcome === "ended") {
    const n = Number(secs) || 0;
    return { missed: false, kind: kind === "video" ? "video" : "audio", text: `${label} · ${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}` };
  }
  return { missed: true, kind: kind === "video" ? "video" : "audio", text: outcome === "declined" ? `${label} bị từ chối` : `${label} nhỡ` };
}

export const ROLE_VI: Record<string, string> = { OWNER: "Chủ tiệm", TECHNICIAN: "Thợ Nail", ADMIN: "Quản trị viên" };

export interface ConversationType {
  id: string;
  isGroup: boolean;
  name: string | null;
  createdAt: string;
  participants: UserType[];
  messages: { id: string; body: string; type: string; senderId: string; conversationId: string; createdAt: string }[];
  unreadCount?: number;
  partnerLastReadAt?: string | null;
}

export interface ActiveChatType {
  id: string;
  name: string;
  avatarUrl: string;
  role: string;
  isGroup: boolean;
  isOnline: boolean;
  statusText: string;
  conversationId?: string;
}

export interface MessagesContentProps {
  initialSessionUser: any;
  initialConversations: any[];
  initialMessages: any[];
  initialSystemUsers: any[];
}

// ---------------------------------------------------------------------------
// Local message cache: Record<chatKey, ChatBucket>. A chat is keyed by its
// real conversationId once known; a brand-new 1-1 chat that hasn't sent or
// received a first message yet has no conversationId, so it's keyed by
// `partner:<userId>` until the server resolves a real one (see rekeyBucket).
//
// This is the whole point of the zero-latency requirement: once a chat's key
// has an entry here, switching back to it renders its messages on the same
// frame — no fetch, no spinner, nothing. A background refresh still runs to
// pick up anything new, but it only ever merges into the bucket, never clears
// it, so the screen never goes blank.
// ---------------------------------------------------------------------------
export interface ChatBucket {
  messages: MessageType[];
  nextCursor: string | null;
}

export function chatKeyFor(chat: { id: string; conversationId?: string } | null | undefined): string | null {
  if (!chat) return null;
  return chat.conversationId || `partner:${chat.id}`;
}

export function mergeSorted(a: MessageType[], b: MessageType[]): MessageType[] {
  const map = new Map<string, MessageType>();
  a.forEach((m) => map.set(m.id, m));
  b.forEach((m) => map.set(m.id, m));
  return Array.from(map.values()).sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
  );
}

export function mapServerMessage(m: any): MessageType {
  return {
    id: m.id,
    content: m.content || m.body || "",
    type: m.type || "TEXT",
    senderId: m.senderId,
    receiverId: m.receiverId || "",
    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    sender: m.sender
      ? { id: m.sender.id, name: m.sender.name, avatarUrl: m.sender.avatarUrl || null, role: m.sender.role }
      : { id: "", name: "User", role: "USER" } as any,
    receiver: m.receiver
      ? { id: m.receiver.id, name: m.receiver.name, avatarUrl: m.receiver.avatarUrl || null, role: m.receiver.role }
      : { id: "", name: "User", role: "USER" } as any,
    conversationId: m.conversationId,
  };
}

