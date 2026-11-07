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
// Sticker (Noto trên fonts.gstatic.com + Fluent 3D trên jsDelivr, cố định commit) và GIF GIPHY: quy tắc RIÊNG đặt TRƯỚC
// quy tắc mặc định "google-fonts-webfonts" (CacheFirst, chỉ 4 mục — từng khớp mọi URL sticker trên fonts.gstatic.com nên
// sticker gần như không được cache). Mọi <img> sticker / GIF dùng crossorigin="anonymous" (các host này gửi ACAO: *)
// → phản hồi không "opaque", cache được đúng trạng thái 200. Hình động sticker = lottie.json (8–90 KB, fetch CORS) cùng
// quy tắc pn-stickers; Noto ghim /s/e/notoemoji/17.0/ nên URL không đổi nội dung. LƯU Ý: service worker tự fetch các URL
// này → CSP connect-src (header dưới, cũng phục vụ /sw.js) PHẢI có fonts.gstatic.com, cdn.jsdelivr.net, *.giphy.com,
// *.tenor.com — thiếu là mọi sticker / GIF lỗi net::ERR_FAILED ngay khi SW được cài.
const mediaCaching = [
  // Hình động sticker (lottie.json, tới ~90 KB/cái) — kho RIÊNG, tối đa 120 file (ảnh tĩnh vài KB dùng kho 500 mục bên dưới)
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/s\/e\/notoemoji\/[^/]+\/[0-9a-f_]+\/lottie\.json$/,
    handler: "CacheFirst",
    options: { cacheName: "pn-sticker-anim", expiration: { maxEntries: 120, maxAgeSeconds: 5184000 }, cacheableResponse: { statuses: [200] } },
  },
  {
    urlPattern: /^https:\/\/(fonts\.gstatic\.com\/s\/e\/notoemoji\/|cdn\.jsdelivr\.net\/gh\/microsoft\/fluentui-emoji@)/,
    handler: "CacheFirst",
    options: { cacheName: "pn-stickers", expiration: { maxEntries: 500, maxAgeSeconds: 5184000 }, cacheableResponse: { statuses: [200] } },
  },
  // GIF dạng MP4 (tin GIF từ 11/2026 + ô trong bảng GIF): <video> xin theo từng đoạn (Range → 206) — CacheFirst không lưu được
  // 206 và trả nguyên tệp 200 cho yêu cầu Range thì Safari không phát. Đi thẳng mạng (bộ đệm HTTP của trình duyệt vẫn giữ).
  // ĐẶT TRƯỚC quy tắc pn-gifs bên dưới (khớp mọi URL media*.giphy.com).
  {
    urlPattern: /^https:\/\/media\d*\.giphy\.com\/[^?#]+\.mp4(?:[?#]|$)/,
    handler: "NetworkOnly",
  },
  {
    urlPattern: /^https:\/\/media\d*\.giphy\.com\//,
    handler: "CacheFirst",
    options: { cacheName: "pn-gifs", expiration: { maxEntries: 150, maxAgeSeconds: 604800 }, cacheableResponse: { statuses: [200] } },
  },
];
const runtimeCaching = [
  ...mediaCaching,
  ...(defaultRuntimeCaching as Array<{ options?: Record<string, unknown>; handler?: string }>).map((entry) => {
    if (entry?.options?.cacheName !== "apis") return entry;
    // NetworkOnly (không bao giờ ghi phản hồi vào đĩa) không dùng chung được
    // với networkTimeoutSeconds (Workbox báo lỗi build) — bỏ key đó, giữ
    // nguyên object options để Workbox vẫn đọc được các trường khác.
    const { networkTimeoutSeconds, ...keptOptions } = entry.options as Record<string, unknown>;
    void networkTimeoutSeconds;
    return { ...entry, handler: "NetworkOnly", options: keptOptions };
  }),
];

// LOCAL QA ONLY: a build made with NEXT_PUBLIC_PUSHER_TEST_WS=127.0.0.1:<port> (scripts/qa/call_test.mjs) may open a
// WebSocket to the Pusher mock on loopback. Never on Vercel, never a non-loopback host.
const PUSHER_TEST_WS = process.env.NEXT_PUBLIC_PUSHER_TEST_WS || "";
const PUSHER_TEST_CONNECT =
  !process.env.VERCEL && !process.env.VERCEL_ENV && /^(127\.0\.0\.1|localhost):\d{2,5}$/.test(PUSHER_TEST_WS) ? ` ws://${PUSHER_TEST_WS} http://${PUSHER_TEST_WS}` : "";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching,
  // Giữ giới hạn 2MB: không tải trước các gói JS lớn ngay lần mở app đầu tiên
  // (tốn 4G của người dùng). Trước đây chủ yếu là gói gọi video ZegoCloud (~5MB) —
  // đã bỏ (11/2026): cuộc gọi giờ dùng WebRTC có sẵn của trình duyệt, màn hình
  // gọi chỉ vài chục KB và tải trước khi rảnh (lib/callPreload.ts).
  maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
  // Without this, a fully-offline visit to an uncached route showed the
  // browser's generic native offline error page instead of anything
  // PawNail-branded. Workbox serves this static, precached page for any
  // navigation request that fails purely because there's no network.
  fallbacks: {
    document: "/offline",
  },
});

// ---- Ngôn ngữ: tiếng Anh mặc định, tiếng Việt khi được chọn ----
// Mọi trang nằm dưới app/[lang] và được prerender cho /en/… và /vi/…. URL công
// khai không có tiền tố; router của Vercel (không gọi function) chọn bản đúng:
//   cookie bitpaw_locale=vi                      → /vi/…
//   chưa có cookie + tiếng Việt ĐỨNG ĐẦU Accept-Language → /vi/…
//   còn lại (en, es, zh, ko…, Googlebot, link preview) → /en/…
// /vi/… là URL tiếng Việt tường minh (Google lập chỉ mục được); /en/… → 308 về URL
// không tiền tố. KHÔNG thêm "Vary: Cookie" — cache của Vercel đã tách theo đường
// dẫn sau rewrite, Vary theo cookie phiên chỉ làm vỡ cache. Quy tắc dùng chung:
// lib/i18n/config.ts (negotiateLocale), kiểm tra: scripts/qa/ssr_locale_check.mjs.
const VI_COOKIE = { type: "cookie" as const, key: "bitpaw_locale", value: "vi" };
const ANY_LOCALE_COOKIE = { type: "cookie" as const, key: "bitpaw_locale" };
// Next/Vercel bọc giá trị thành ^…$ — chỉ khớp khi "vi" là thẻ ĐẦU TIÊN.
const VI_FIRST = { type: "header" as const, key: "accept-language", value: "\\s*[vV][iI](?:[-_;,].*)?" };
// Đường dẫn trang (không phải API, asset của Next/Vercel/Cloudflare, .well-known,
// tệp có đuôi trong /public, hay URL đã có tiền tố ngôn ngữ).
const PAGE_PATH = "/:path((?!(?:api|_next|_vercel|cdn-cgi|vi|en|\\.well-known)(?:/|$))(?!__next)(?!.*\\.[A-Za-z0-9]{1,6}$).+)";

const nextConfig: NextConfig = {
  experimental: {
    // Layout gốc nằm dưới app/[lang] → 404 cho URL không khớp route nào do
    // app/global-not-found.tsx render (HTML tĩnh, song ngữ EN trước).
    globalNotFound: true,
  },
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", has: [VI_COOKIE], destination: "/vi" },
        { source: "/", has: [VI_FIRST], missing: [ANY_LOCALE_COOKIE], destination: "/vi" },
        { source: "/", destination: "/en" },
        { source: PAGE_PATH, has: [VI_COOKIE], destination: "/vi/:path" },
        { source: PAGE_PATH, has: [VI_FIRST], missing: [ANY_LOCALE_COOKIE], destination: "/vi/:path" },
        { source: PAGE_PATH, destination: "/en/:path" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
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
      // GIF Tenor (tab GIF khi cấu hình TENOR_API_KEY)
      { protocol: "https", hostname: "media.tenor.com" },
      { protocol: "https", hostname: "*.tenor.com" },
      // Avatar mặc định lúc đăng ký (app/api/register) — đã có trong CSP
      // img-src nhưng thiếu ở đây, nên mọi <NextImage> avatar mặc định bị
      // image-optimizer trả 400 (ảnh vỡ) cho toàn bộ user mới.
      { protocol: "https", hostname: "api.dicebear.com" },
      // Sticker 3D Microsoft Fluent Emoji (MIT) — CHỈ đúng repo + commit cố định (lib/stickers/paths.generated.ts);
      // ô nhỏ trong bảng sticker đi qua /_next/image (WebP 96px ~3–6 KB thay cho PNG 256px ~33 KB).
      { protocol: "https", hostname: "cdn.jsdelivr.net", pathname: "/gh/microsoft/fluentui-emoji@1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/**" },
    ],
    // Next 16 chỉ nhận các mức chất lượng khai báo ở đây: 75 (mặc định) + 70 (ô sticker)
    qualities: [70, 75],
  },
  async headers() {
    return [
      // URL không tiền tố trả EN hoặc VI tuỳ cookie / Accept-Language. Cache của
      // Vercel tách theo đường dẫn sau rewrite nên an toàn; header này chặn
      // Cloudflare (đứng trước Vercel) lỡ cache 1 bản cho mọi người nếu sau này
      // zone bật "Cache Everything". Chỉ Cloudflare đọc header này.
      { source: "/", headers: [{ key: "Cloudflare-CDN-Cache-Control", value: "no-store" }] },
      { source: PAGE_PATH, headers: [{ key: "Cloudflare-CDN-Cache-Control", value: "no-store" }] },
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
            // Next's inline hydration scripts may depend on one or both. That
            // needs a nonce-based CSP + a real build/runtime test before
            // flipping, so it's left as-is here; object-src/base-uri/form-action
            // below are safe, no-risk additions.
            // Calls (11/2026): 1:1 voice/video use the browser's own WebRTC (lib/calls/peer.ts) — no third-party call
            // SDK, no iframe. Signaling rides the existing Pusher socket (wss://*.pusher.com) + same-origin /api/calls;
            // STUN/TURN traffic is not governed by connect-src. All ZEGOCLOUD hosts (*.zegocloud.com, *.zego.im and
            // its coolb/coolg/coolz/coolf logging domains) were removed with the SDK; frame-src is back to 'self'.
            // PUSHER_TEST_CONNECT adds ws://127.0.0.1:<port> ONLY for a local QA build made with
            // NEXT_PUBLIC_PUSHER_TEST_WS (never on Vercel) — see scripts/qa/call_test.mjs.
            // Added res.cloudinary.com to media-src (video portfolio / tin
            // tuyển trước đây bị chặn phát) + api.cloudinary.com to connect-src
            // (video tải thẳng từ trình duyệt lên Cloudinary bằng chữ ký máy
            // chủ — Vercel giới hạn body ~4.5MB nên không đi qua /api/upload).
            // media.tenor.com / *.giphy.com in img-src: GIF tiles + GIF messages are raw <img> pointing at the
            // provider's media host (results come from /api/gifs). *.giphy.com in media-src (11/2026): GIPHY GIFs are
            // sent + previewed as the provider's MP4 rendition (<video>, poster = still on the same host, img-src).
            // cdn.jsdelivr.net in img-src (11/2026): Fluent
            // Emoji 3D sticker PNGs (MIT), pinned to one commit of github.com/microsoft/fluentui-emoji.
            // Added *.sentry.io to connect-src + worker-src blob: — phát hiện
            // qua regression scan: Sentry SDK (đã cài qua wizard, không phải do
            // phiên làm việc này thêm) bị CSP chặn cả envelope report (connect-src
            // thiếu *.sentry.io) lẫn worker nội bộ tải qua blob: (chưa có
            // worker-src riêng nên rơi về script-src, không cho phép blob:).
            // Added fonts.gstatic.com to img-src (16/10/2026) — sticker Noto Emoji (ảnh tĩnh .svg) nằm ở fonts.gstatic.com;
            // thiếu là sticker bị chặn, rơi về emoji chữ của hệ điều hành.
            // Added fonts.gstatic.com + cdn.jsdelivr.net + *.giphy.com + *.tenor.com to connect-src (11/2026): hình động
            // sticker là lottie.json tải bằng fetch, VÀ service worker (cùng CSP này trên /sw.js) tự fetch ảnh sticker /
            // GIF để cache — connect-src thiếu host nào thì SW trả net::ERR_FAILED cho mọi ảnh của host đó.
            // Added api.dicebear.com to img-src — avatar mặc định lúc đăng ký
            // đổi sang DiceBear fun-emoji (xem app/api/register/route.ts),
            // domain này chưa có sẵn nên ảnh sẽ bị CSP chặn nếu không thêm.
            // Added cloudflareinsights.com (script-src + connect-src) —
            // Cloudflare tự chèn beacon Web Analytics vào mọi trang, CSP cũ
            // chặn nó nên console production báo lỗi ở mọi trang và analytics
            // không ghi nhận lượt truy cập nào.
            // Added res.cloudinary.com + images.unsplash.com to connect-src —
            // "Thẻ portfolio" (components/profile/ShareCard) fetch ảnh mẫu móng
            // về dạng blob để vẽ lên canvas mà không làm canvas bị "bẩn".
            value: `upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://images.unsplash.com https://res.cloudinary.com https://ui-avatars.com https://api.dicebear.com https://*.basemaps.cartocdn.com https://*.openstreetmap.org https://*.giphy.com https://*.tenor.com https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://images.unsplash.com https://*.pusher.com wss://*.pusher.com https://api.giphy.com https://*.sentry.io https://cloudflareinsights.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://*.giphy.com https://*.tenor.com${PUSHER_TEST_CONNECT}; worker-src 'self' blob:; font-src 'self' https://fonts.gstatic.com; frame-src 'self'; media-src 'self' blob: https://*.giphy.com https://res.cloudinary.com; object-src 'none'; base-uri 'self'; form-action 'self';`,
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
