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
            value: "upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.zegocloud.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://images.unsplash.com https://res.cloudinary.com https://ui-avatars.com https://*.basemaps.cartocdn.com https://*.openstreetmap.org https://*.giphy.com https://*.tenor.com; connect-src 'self' https://*.zegocloud.com wss://*.zegocloud.com https://*.pusher.com wss://*.pusher.com https://api.giphy.com; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://*.zegocloud.com; media-src 'self' blob: https://*.giphy.com; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);