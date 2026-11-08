// Service worker tuỳ biến — next-pwa tự gộp file này vào public/sw.js lúc build
// (thư mục mặc định "worker"). Xử lý THÔNG BÁO ĐẨY từ lib/push.ts.

// Cuộc gọi đã kết thúc (tag → nội dung "Cuộc gọi nhỡ…") — nhớ trong lúc service worker còn sống, để một tin "đang gọi"
// tới MUỘN hơn tin kết thúc (thứ tự giao không đảm bảo) không hiện lại "X đang gọi cho bạn".
const endedCalls = new Map();
const rememberEnded = (tag, content) => {
  endedCalls.set(tag, content);
  if (endedCalls.size > 30) endedCalls.delete(endedCalls.keys().next().value);
};
// Cho phép đồng hồ máy lệch so với máy chủ tới 5 phút (xem bên dưới).
const EXP_SKEW_MS = 5 * 60 * 1000;
const isCallTag = (tag) => tag === "pn-call" || (typeof tag === "string" && tag.indexOf("pn-call-") === 0);

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
  const tag = data.tag || "pn";
  const kind = data.kind || (isCallTag(tag) ? "call" : null);
  let title = data.title || "PawNail";
  let body = data.body || "";
  let ringing = kind === "call";
  // Tin "đang gọi" tới muộn (quá hạn, hoặc cuộc gọi đã có tin kết thúc) → hiện "Cuộc gọi nhỡ…" thay vì chuông giả.
  // exp là giờ MÁY CHỦ, Date.now() là giờ của máy này: đồng hồ máy chạy nhanh vài phút không được biến cuộc gọi đang đổ
  // chuông thành "Cuộc gọi nhỡ" → chừa EXP_SKEW_MS. Dịch vụ đẩy đã tự bỏ tin quá TTL 60 s; exp chỉ là lưới an toàn.
  if (ringing) {
    const ended = endedCalls.get(tag);
    const stale = ended || ((typeof data.exp === "number" && Date.now() > data.exp + EXP_SKEW_MS && data.stale) || null);
    if (stale) {
      title = stale.title || title;
      body = stale.body || "";
      ringing = false;
    }
  }
  const silent = kind === "call-end" && !!data.quiet;
  const options = {
    body,
    icon: data.icon || "/icons/icon-192.webp?v=b",
    // Android paints the badge from its ALPHA only — a full-colour icon became a white square; this is a white B on transparent.
    badge: "/icons/badge-b-96.png",
    tag,
    // Cuộc gọi kết thúc THAY thông báo "đang gọi" lặng lẽ (không rung / kêu lại).
    renotify: kind !== "call-end",
    requireInteraction: ringing,
    data: { url: data.url || "/" },
  };
  // silent + vibrate together is a TypeError in showNotification.
  if (silent) options.silent = true;
  else options.vibrate = ringing ? [300, 150, 300, 150, 300] : [60, 40, 60];
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (wins) => {
      const watching = wins.some((w) => w.visibilityState === "visible" && w.focused);
      if (kind === "call-end") {
        rememberEnded(tag, { title, body });
        // Thông báo cuộc gọi đang hiện (tag riêng của cuộc gọi này + tag chung "pn-call" của bản cũ).
        const shown = (await self.registration.getNotifications()).filter((n) => n.tag === tag || n.tag === "pn-call");
        if (watching) {
          // Đang nhìn PawNail: trong app đã báo — chỉ dọn thông báo cũ.
          shown.forEach((n) => n.close());
          return undefined;
        }
        shown.filter((n) => n.tag !== tag).forEach((n) => n.close());
        // "Đã trả lời / từ chối ở máy khác" khi không còn gì để thay: vẫn phải hiện (trình duyệt bắt buộc), nhưng lặng lẽ.
        return self.registration.showNotification(title, options);
      }
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
