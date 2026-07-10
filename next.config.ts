import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  typescript: { ignoreBuildErrors: true },
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
            value: "upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.zegocloud.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://images.unsplash.com https://res.cloudinary.com https://ui-avatars.com https://*.basemaps.cartocdn.com https://*.openstreetmap.org; connect-src 'self' https://*.zegocloud.com wss://*.zegocloud.com https://*.pusher.com wss://*.pusher.com; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://*.zegocloud.com; media-src 'self' blob:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;