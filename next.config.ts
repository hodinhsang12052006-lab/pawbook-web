import type { NextConfig } from "next";

const nextConfig: any = {
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  webpack: (config: any) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  // Đưa ra ngoài root theo đúng yêu cầu của log Vercel để không bị sập
  serverExternalPackages: ['canvas', 'pdf-parse'],
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu/**/*',
      'node_modules/@swc/core-linux-x64-musl/**/*',
      'node_modules/@swc/wasm/**/*',
      'node_modules/canvas/**/*',
      'node_modules/pdf-parse/**/*'
    ],
  },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;