"use client";

import { useEffect, useState } from "react";
import type { PresenceChannel } from "pusher-js";
import { getPusherClient } from "./pusherClient";

// Trạng thái online THẬT qua Pusher presence channel "presence-user-<id>":
// - Người đang mở app tự vào kênh của chính mình (joinOwnPresence).
// - Ai muốn biết X có online không thì vào kênh của X và kiểm tra trong danh
//   sách thành viên có X hay không (server chỉ cho phép nếu 2 người từng nhắn
//   tin chung, xem app/api/pusher/auth).
// Nhiều component cùng xem 1 người (danh sách hội thoại + header chat) dùng
// chung 1 lượt subscribe nhờ đếm tham chiếu.

const presenceName = (userId: string) => `presence-user-${userId}`;

interface Entry {
  channel: PresenceChannel;
  refCount: number;
  listeners: Set<() => void>;
}
const entries = new Map<string, Entry>();

function acquire(userId: string): Entry | null {
  const pusher = getPusherClient();
  if (!pusher || !userId) return null;
  const name = presenceName(userId);
  const existing = entries.get(name);
  if (existing) {
    existing.refCount += 1;
    return existing;
  }
  const channel = pusher.subscribe(name) as PresenceChannel;
  const entry: Entry = { channel, refCount: 1, listeners: new Set() };
  const notify = () => entry.listeners.forEach((fn) => fn());
  channel.bind("pusher:subscription_succeeded", notify);
  channel.bind("pusher:member_added", notify);
  channel.bind("pusher:member_removed", notify);
  entries.set(name, entry);
  return entry;
}

function release(userId: string) {
  const name = presenceName(userId);
  const entry = entries.get(name);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entries.delete(name);
    getPusherClient()?.unsubscribe(name);
  }
}

export function joinOwnPresence(userId: string): () => void {
  if (!acquire(userId)) return () => {};
  return () => release(userId);
}

export function useIsOnline(userId: string | null | undefined): boolean {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const entry = acquire(userId);
    if (!entry) return;
    const check = () => {
      try {
        setOnline(Boolean(entry.channel.members?.get(userId)));
      } catch {
        setOnline(false);
      }
    };
    entry.listeners.add(check);
    check();
    return () => {
      entry.listeners.delete(check);
      release(userId);
    };
  }, [userId]);

  return userId ? online : false;
}

// "Hoạt động 5 phút trước" — chỉ hiện khi biết mốc hoạt động thật.
export function lastActiveLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Vừa hoạt động";
  if (mins < 60) return `Hoạt động ${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hoạt động ${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hoạt động ${days} ngày trước`;
  return null;
}
