"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { getPusherClient } from "@/lib/pusherClient";

// Link https://www.bitpawos.com/... mở app qua App Links (Android) / Universal
// Links (iOS). Ở hosted mode Capacitor KHÔNG tự điều hướng tới link đó (chỉ mở
// trang chủ), nên JS phải tự chuyển trang. Chỉ nhận đúng domain bitpawos.com.
const LAUNCH_KEY = "pn_launch_url_done";

function appLinkTarget(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || (u.hostname !== "bitpawos.com" && !u.hostname.endsWith(".bitpawos.com"))) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

// Chỉ có tác dụng khi chạy trong app native (Capacitor WebView) — không làm
// gì trên web/PWA thường, nơi trình duyệt tự xử lý nút Back và tab
// background/foreground theo cách riêng của nó.
export default function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backHandle: PluginListenerHandle | undefined;
    let resumeHandle: PluginListenerHandle | undefined;
    let urlOpenHandle: PluginListenerHandle | undefined;

    // Chuyển trang phía client (router.push), không gán window.location: đổi
    // trang kiểu đó khi trang chủ còn đang tải dở làm WKWebView huỷ lượt tải cũ
    // và Capacitor hiện nhầm màn "mất mạng" (server.errorPath).
    let last = { url: "", at: 0 };
    const openAppLink = (url: string) => {
      const target = appLinkTarget(url);
      if (!target) return;
      // Khi mở app nguội, iOS có thể báo cùng 1 link qua cả appUrlOpen lẫn getLaunchUrl.
      if (last.url === url && Date.now() - last.at < 3000) return;
      last = { url, at: Date.now() };
      try {
        sessionStorage.setItem(LAUNCH_KEY, url);
      } catch {}
      if (target !== window.location.pathname + window.location.search + window.location.hash) router.push(target);
    };

    // App đang chạy (hoặc vừa được mở) bằng một link.
    App.addListener("appUrlOpen", ({ url }) => openAppLink(url)).then((handle) => {
      urlOpenHandle = handle;
    });

    // App mở nguội bằng link: chỉ xử lý 1 lần mỗi phiên WebView. Component này
    // mount lại sau mỗi lần tải toàn trang (vd sau đăng nhập), getLaunchUrl thì
    // vẫn trả đúng link cũ, nên phải nhớ là đã mở rồi.
    App.getLaunchUrl()
      .then((launch) => {
        if (!launch?.url) return;
        let done: string | null = null;
        try {
          done = sessionStorage.getItem(LAUNCH_KEY);
        } catch {}
        if (done !== launch.url) openAppLink(launch.url);
      })
      .catch(() => {});

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
      urlOpenHandle?.remove();
    };
  }, [router]);

  return null;
}
