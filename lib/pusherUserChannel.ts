"use client";

import type { Channel } from "pusher-js";
import { getPusherClient } from "./pusherClient";
import { chatChannelName } from "./pusherChannel";

interface ChannelEntry {
  channel: Channel;
  refCount: number;
}

const channels = new Map<string, ChannelEntry>();

// Kênh Pusher cá nhân "private-chat-<userId>" được DÙNG CHUNG bởi 3 nơi độc
// lập: CallManager (chuông gọi đến), MessagesContent (tin nhắn realtime khi
// đang mở /messages), và UnreadMessagesContext (badge tin nhắn chưa đọc,
// mount toàn cục). pusher-js chỉ giữ ĐÚNG 1 object Channel cho mỗi tên kênh
// — gọi `pusher.subscribe(name)` nhiều lần từ nhiều component khác nhau vẫn
// trả về CÙNG 1 object.
//
// Bug gốc đã sửa ở đây: trước kia mỗi nơi tự `pusher.subscribe()` rồi khi
// unmount tự gọi `channel.unbind_all()` + `pusher.unsubscribe()` — vì đó là
// object DÙNG CHUNG, hành động này xóa sạch luôn listener của 2 nơi còn lại.
// Cụ thể: mỗi lần người dùng rời trang /messages, MessagesContent unmount và
// vô tình xóa mất listener "incoming-call" của CallManager (chuông không
// bao giờ reo nữa cho tới khi F5) và listener "new-message" của
// UnreadMessagesContext (badge chết theo).
//
// Ref-count ở đây đảm bảo kênh chỉ THẬT SỰ unsubscribe khỏi Pusher khi không
// còn ai cần nó nữa. Mọi nơi dùng kênh này phải: (1) gọi acquireUserChannel
// lúc mount, (2) chỉ bind/unbind ĐÚNG handler của mình bằng tham chiếu hàm
// (không bao giờ unbind_all()), (3) gọi releaseUserChannel lúc unmount.
export function acquireUserChannel(userId: string): Channel | null {
  const pusher = getPusherClient();
  if (!pusher || !userId) return null;

  const name = chatChannelName(userId);
  const existing = channels.get(name);
  if (existing) {
    existing.refCount += 1;
    return existing.channel;
  }

  const channel = pusher.subscribe(name);
  channels.set(name, { channel, refCount: 1 });
  return channel;
}

export function releaseUserChannel(userId: string): void {
  const pusher = getPusherClient();
  if (!pusher || !userId) return;

  const name = chatChannelName(userId);
  const existing = channels.get(name);
  if (!existing) return;

  existing.refCount -= 1;
  if (existing.refCount <= 0) {
    channels.delete(name);
    pusher.unsubscribe(name);
  }
}
