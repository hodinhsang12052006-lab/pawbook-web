// Service worker tuỳ biến — next-pwa tự gộp file này vào public/sw.js lúc build
// (thư mục mặc định "worker"). Xử lý THÔNG BÁO ĐẨY từ lib/push.ts.

// Nhận thông báo đẩy. Nếu người dùng ĐANG mở PawNail và nhìn màn hình thì bỏ
// qua — trong app đã có chuông, âm thanh và toast; hiện thêm thông báo hệ
// thống là trùng lặp, gây phiền.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "PawNail", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "PawNail";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.webp",
    badge: "/icons/icon-96.webp",
    tag: data.tag || "pn",
    renotify: true,
    vibrate: data.tag === "pn-call" ? [300, 150, 300, 150, 300] : [60, 40, 60],
    requireInteraction: data.tag === "pn-call",
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const watching = wins.some((w) => w.visibilityState === "visible" && w.focused);
      if (watching) return undefined;
      return self.registration.showNotification(title, options);
    })
  );
});

// Bấm vào thông báo → mở đúng trang (dùng lại tab PawNail đang mở nếu có).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.focus().then((c) => (c && "navigate" in c ? c.navigate(url) : undefined));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
