"use client";

import { signOut } from "next-auth/react";
import { releasePushOnSignOut } from "@/lib/pushClient";

// Đăng xuất của PawNail (mọi nút Đăng xuất + sau khi xoá tài khoản): TRƯỚC KHI xoá phiên, gỡ thiết bị này khỏi thông
// báo đẩy của tài khoản đang đăng xuất (máy chủ cần phiên để làm việc này) và xoá dữ liệu chat app Android đã lưu
// (thông báo, lịch sử tin, lối tắt hội thoại, ảnh đại diện). Trước đây chỉ signOut() → điện thoại dùng chung ở tiệm vẫn
// hiện tin nhắn của người đã đăng xuất cho người dùng sau. Chờ tối đa 1,5 s: mạng chậm không giữ người dùng lại.
const RELEASE_TIMEOUT_MS = 1500;

export async function appSignOut(options?: Parameters<typeof signOut>[0]) {
  await Promise.race([releasePushOnSignOut().catch(() => {}), new Promise((r) => setTimeout(r, RELEASE_TIMEOUT_MS))]);
  return signOut(options);
}
