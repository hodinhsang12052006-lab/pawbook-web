import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import path from "path";
// next-pwa ships no TypeScript declarations.
// @ts-expect-error - untyped CommonJS module
import withPWAInit from "next-pwa";
// @ts-expect-error - untyped CommonJS module
import defaultRuntimeCaching from "next-pwa/cache";

// Mặc định next-pwa ghi MỌI phản hồi /api/* (trừ /api/auth/*) vào Cache
// Storage của trình duyệt trong 24h — gồm cả /api/profile (email, SĐT),
// /api/messages (nội dung chat riêng tư) và /api/admin/leads (PII toàn bộ
// user). Trên máy dùng chung/công cộng, dữ liệu này còn lại SAU KHI đăng
// xuất và đọc được qua DevTools. Thay quy tắc "apis" bằng NetworkOnly để các
// phản hồi cần đăng nhập KHÔNG BAO GIỜ nằm trên đĩa; các asset tĩnh (ảnh,
// JS, CSS, font) vẫn được cache bình thường cho tốc độ/offline.
const runtimeCaching = (defaultRuntimeCaching as Array<{ options?: Record<string, unknown>; handler?: string }>).map(
  (entry) => {
    if (entry?.options?.cacheName !== "apis") return entry;
    // NetworkOnly (không bao giờ ghi phản hồi vào đĩa) không dùng chung được
    // với networkTimeoutSeconds (Workbox báo lỗi build) — bỏ key đó, giữ
    // nguyên object options để Workbox vẫn đọc được các trường khác.
    const { networkTimeoutSeconds, ...keptOptions } = entry.options as Record<string, unknown>;
    void networkTimeoutSeconds;
    return { ...entry, handler: "NetworkOnly", options: keptOptions };
  }
);

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching,
  // Giữ giới hạn 2MB: KHÔNG tải trước gói gọi video ZegoCloud (~5MB) ngay lần
  // mở app đầu tiên — tốn 4G của người dùng trong khi gọi video lúc offline
  // vốn không dùng được. Gói đó tải khi có cuộc gọi (rồi trình duyệt tự cache).
  // Tổng tải trước giảm từ ~8.7MB xuống ~3.8MB.
  maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
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
  // Không quảng cáo framework/phiên bản cho kẻ dò lỗ hổng.
  poweredByHeader: false,
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
      // Avatar mặc định lúc đăng ký (app/api/register) — đã có trong CSP
      // img-src nhưng thiếu ở đây, nên mọi <NextImage> avatar mặc định bị
      // image-optimizer trả 400 (ảnh vỡ) cho toàn bộ user mới.
      { protocol: "https", hostname: "api.dicebear.com" },
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
            // Added res.cloudinary.com to media-src (video portfolio / tin
            // tuyển trước đây bị chặn phát) + api.cloudinary.com to connect-src
            // (video tải thẳng từ trình duyệt lên Cloudinary bằng chữ ký máy
            // chủ — Vercel giới hạn body ~4.5MB nên không đi qua /api/upload).
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
            // Added *.coolfcloud.com + *.zego.im (connect-src) — ZEGOCLOUD cân bằng
            // tải qua nhiều domain (coolb/coolg/coolz/coolf...). Thiếu domain nào thì
            // cuộc gọi rơi vào domain đó kẹt "Joining Room" vĩnh viễn — lỗi ngẫu
            // nhiên đã bắt được khi test 2 trình duyệt (CSP chặn accesshub-wss.coolfcloud.com).
            // Added cloudflareinsights.com (script-src + connect-src) —
            // Cloudflare tự chèn beacon Web Analytics vào mọi trang, CSP cũ
            // chặn nó nên console production báo lỗi ở mọi trang và analytics
            // không ghi nhận lượt truy cập nào.
            // Added *.coolgcloud.com + *.coolzcloud.com to connect-src — test
            // gọi video 2-browser thật phát hiện ZegoCloud SDK còn dùng CẢ 3
            // domain logging khác nhau (coolbcloud/coolgcloud/coolzcloud —
            // chỉ khác 1 chữ cái, trước đây chỉ thêm coolbcloud) nên vẫn còn
            // bị CSP chặn. LƯU Ý: các domain này chỉ phục vụ log/telemetry
            // nội bộ của SDK — không phải nguyên nhân cuộc gọi video thất bại.
            // Nguyên nhân thật là App ID trong .env.local bị gõ sai 1 số
            // (1829171707 thay vì 1829174707 thật trên console ZegoCloud) —
            // đã sửa cả .env và .env.local, đã verify bằng Playwright 2 tài
            // khoản thật kết nối thành công (xem log "appid invalid" 1001004
            // biến mất sau khi sửa).
            value: "upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.zegocloud.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://images.unsplash.com https://res.cloudinary.com https://ui-avatars.com https://api.dicebear.com https://*.basemaps.cartocdn.com https://*.openstreetmap.org https://*.giphy.com https://*.tenor.com; connect-src 'self' https://api.cloudinary.com https://*.zegocloud.com wss://*.zegocloud.com https://*.coolbcloud.com wss://*.coolbcloud.com https://*.coolgcloud.com wss://*.coolgcloud.com https://*.coolzcloud.com wss://*.coolzcloud.com https://*.coolfcloud.com wss://*.coolfcloud.com https://*.zego.im wss://*.zego.im https://*.pusher.com wss://*.pusher.com https://api.giphy.com https://*.sentry.io https://cloudflareinsights.com; worker-src 'self' blob:; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://*.zegocloud.com; media-src 'self' blob: https://*.giphy.com https://res.cloudinary.com; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withPWA(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "bitpaw",

  project: "javascript-nextjs-nm",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
