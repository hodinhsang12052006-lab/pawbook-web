"use client";

import { useEffect } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { getPusherClient } from "@/lib/pusherClient";

// Chỉ có tác dụng khi chạy trong app native (Capacitor WebView) — không làm
// gì trên web/PWA thường, nơi trình duyệt tự xử lý nút Back và tab
// background/foreground theo cách riêng của nó.
export default function NativeAppBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backHandle: PluginListenerHandle | undefined;
    let resumeHandle: PluginListenerHandle | undefined;

    // Nút Back vật lý Android: nếu WebView còn lịch sử điều hướng để lùi
    // (canGoBack — Capacitor tự đọc từ webView.canGoBack() tại thời điểm
    // bấm), lùi lại trang trước đó; nếu không còn gì để lùi (đang ở màn
    // gốc), thu nhỏ app về nền thay vì kill tiến trình — đúng hành vi chuẩn
    // Android, tránh cảm giác "bấm Back là văng thẳng ra ngoài" mất luôn
    // form đang nhập dở.
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    }).then((handle) => {
      backHandle = handle;
    });

    // Pusher tự có cơ chế reconnect nội bộ, nhưng iOS/Android có thể tạm
    // dừng JS timer khi app vào nền khá lâu — ép reconnect ngay lúc quay lại
    // foreground để tin nhắn/cuộc gọi không bị trễ vài giây chờ pusher-js tự
    // phát hiện lại kết nối rớt.
    App.addListener("resume", () => {
      const pusher = getPusherClient();
      if (pusher && pusher.connection.state !== "connected") {
        pusher.connect();
      }
    }).then((handle) => {
      resumeHandle = handle;
    });

    return () => {
      backHandle?.remove();
      resumeHandle?.remove();
    };
  }, []);

  return null;
}
