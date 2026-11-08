"use client";

import type { Channel } from "pusher-js";
import { acquireChannel, releaseChannel } from "./pusherClient";
import { chatChannelName } from "./pusherChannel";

// Kênh Pusher cá nhân "private-chat-<userId>" được DÙNG CHUNG bởi nhiều nơi độc
// lập: CallManager (chuông gọi đến), MessagesContent (tin nhắn realtime khi
// đang mở /messages), UnreadMessagesContext (badge tin nhắn chưa đọc, mount
// toàn cục) và NotificationBell. pusher-js chỉ giữ ĐÚNG 1 object Channel cho
// mỗi tên kênh — gọi `pusher.subscribe(name)` nhiều lần từ nhiều component
// khác nhau vẫn trả về CÙNG 1 object.
//
// Bug gốc đã sửa ở đây: trước kia mỗi nơi tự `pusher.subscribe()` rồi khi
// unmount tự gọi `channel.unbind_all()` + `pusher.unsubscribe()` — vì đó là
// object DÙNG CHUNG, hành động này xóa sạch luôn listener của các nơi còn lại
// (rời trang /messages → chuông gọi đến chết cho tới khi F5).
//
// Đếm tham chiếu + giữ kênh luôn subscribe (kể cả khi 1 lần xin quyền
// /api/pusher/auth thất bại lúc mạng chập chờn) nằm ở lib/pusherResilience.ts
// (qua acquireChannel/releaseChannel). Mọi nơi dùng kênh này phải: (1) gọi
// acquireUserChannel lúc mount, (2) chỉ bind/unbind ĐÚNG handler của mình bằng
// tham chiếu hàm (không bao giờ unbind_all()), (3) gọi releaseUserChannel lúc unmount.
export function acquireUserChannel(userId: string): Channel | null {
  if (!userId) return null;
  return acquireChannel(chatChannelName(userId));
}

export function releaseUserChannel(userId: string): void {
  if (!userId) return;
  releaseChannel(chatChannelName(userId));
}
