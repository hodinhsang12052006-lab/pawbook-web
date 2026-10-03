import type { CapacitorConfig } from "@capacitor/cli";

// ⚠️ appId là Bundle ID (iOS) / Application ID (Android) — KHÔNG thể đổi sau
// khi đã publish lần đầu lên App Store / CH Play. "com.bitpawos.app" là giá
// trị mặc định hợp lý (khớp domain bitpawos.com) — xác nhận/đổi giá trị này
// TRƯỚC khi build bản nộp store đầu tiên, không phải sau.
const config: CapacitorConfig = {
  appId: "com.bitpawos.app",
  appName: "PawNail Jobs",
  webDir: "public",

  // Hosted mode — app native chỉ là một WebView trỏ thẳng vào trang web
  // production, không đóng gói/bundle các trang Next.js vào app (khác với
  // mode "static export" đóng gói offline). Nghĩa là mọi bản cập nhật
  // giao diện lên bitpawos.com tự động phản ánh trong app, không cần build
  // lại/nộp bản mới lên store — trừ khi thay đổi bản thân native shell này
  // (icon, splash, quyền, plugin).
  // Phải là "www." — domain trần bitpawos.com trả 308 sang www.bitpawos.com
  // (cấu hình Vercel/Cloudflare). Capacitor coi mọi điều hướng sang host KHÁC
  // host của server.url là link ngoài và mở bằng trình duyệt hệ thống — trỏ
  // vào domain trần khiến app vừa mở đã bị đá ra Chrome/Safari (màn trắng
  // trong app). allowNavigation giữ cả 2 host bên trong WebView phòng khi
  // redirect đổi chiều sau này.
  server: {
    url: "https://www.bitpawos.com",
    androidScheme: "https",
    cleartext: false,
    allowNavigation: ["bitpawos.com", "www.bitpawos.com"],
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#020617", // slate-950 — khớp nền tối thương hiệu hiện tại
      androidSplashResourceName: "splash",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#020617",
    },
  },
};

export default config;
