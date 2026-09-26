import type { NextConfig } from "next";
import path from "path";
// next-pwa ships no TypeScript declarations.
// @ts-expect-error - untyped CommonJS module
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Default 2MB limit silently skipped our largest vendor chunk (ZegoCloud
  // call SDK + map/AI libs bundled together, ~5MB) from the offline
  // precache list every build — bumped just above that chunk's real size so
  // the service worker actually caches it instead of only warning about it.
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  // Without this, a fully-offline visit to an uncached route showed the
  // browser's generic native offline error page instead of anything
  // PawNail-branded. Workbox serves this static, precached page for any
  // navigation request that fails purely because there's no network.
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  // Next.js was misdetecting the monorepo root because a stray
  // package-lock.json sits one directory up (in the user's home folder),
  // outside this project entirely — pin it explicitly instead of letting
  // Next guess and warn about it on every build.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.giphy.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // GifPicker's PERMANENT_GIFS all live on media.tenor.com — this host was
      // missing here, so every GIF message rendered via <NextImage> 400'd at
      // Next's image-optimizer (unlisted hostname), showing only the alt text
      // ("Media Attachment") in a broken image box.
      { protocol: "https", hostname: "media.tenor.com" },
      { protocol: "https", hostname: "*.tenor.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            // NOTE: script-src still carries 'unsafe-eval'/'unsafe-inline' —
            // removing them would meaningfully strengthen XSS mitigation, but
            // Next's inline hydration scripts and the ZegoCloud call SDK may
            // depend on one or both. That needs a nonce-based CSP + a real
            // build/runtime test before flipping, so it's left as-is here;
            // object-src/base-uri/form-action below are safe, no-risk additions.
            // Added media.tenor.com to img-src — the GifPicker's raw <img>
            // thumbnails (components/chat/GifPicker.tsx) point there directly
            // and were being silently CSP-blocked in the browser as well.
            // Added *.coolbcloud.com (wss+https) to connect-src — confirmed via
            // live 2-browser video call testing that ZEGOCLOUD's SDK also opens
            // WebSocket connections to its own logging/access-hub infra on this
            // separate domain (weblogger-wss / accesshub-wss*.coolbcloud.com),
            // outside *.zegocloud.com — CSP was silently blocking those,
            // visible as repeated "violates Content Security Policy" console
            // errors during a live call.
            // Added *.sentry.io to connect-src + worker-src blob: — phát hiện
            // qua regression scan: Sentry SDK (đã cài qua wizard, không phải do
            // phiên làm việc này thêm) bị CSP chặn cả envelope report (connect-src
            // thiếu *.sentry.io) lẫn worker nội bộ tải qua blob: (chưa có
            // worker-src riêng nên rơi về script-src, không cho phép blob:).
            // Added api.dicebear.com to img-src — avatar mặc định lúc đăng ký
            // đổi sang DiceBear fun-emoji (xem app/api/register/route.ts),
            // domain này chưa có sẵn nên ảnh sẽ bị CSP chặn nếu không thêm.
            // Added *.coolgcloud.com + *.coolzcloud.com to connect-src — test
            // gọi video 2-browser thật phát hiện ZegoCloud SDK còn dùng CẢ 3
            // domain logging khác nhau (coolbcloud/coolgcloud/coolzcloud —
            // chỉ khác 1 chữ cái, trước đây chỉ thêm coolbcloud) nên vẫn còn
            // bị CSP chặn. LƯU Ý: các domain này chỉ phục vụ log/telemetry
            // nội bộ của SDK — không phải nguyên nhân cuộc gọi thất bại (xem
            // lỗi thật "appid invalid" 1001004 đã báo riêng, cần sửa ở phía
            // ZegoCloud console/env, không phải ở CSP).
            value: "upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.zegocloud.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://images.unsplash.com https://res.cloudinary.com https://ui-avatars.com https://api.dicebear.com https://*.basemaps.cartocdn.com https://*.openstreetmap.org https://*.giphy.com https://*.tenor.com; connect-src 'self' https://*.zegocloud.com wss://*.zegocloud.com https://*.coolbcloud.com wss://*.coolbcloud.com https://*.coolgcloud.com wss://*.coolgcloud.com https://*.coolzcloud.com wss://*.coolzcloud.com https://*.pusher.com wss://*.pusher.com https://api.giphy.com https://*.sentry.io; worker-src 'self' blob:; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://*.zegocloud.com; media-src 'self' blob: https://*.giphy.com; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);