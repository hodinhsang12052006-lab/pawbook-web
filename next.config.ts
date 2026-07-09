import type { NextConfig } from "next";

const nextConfig: any = {
  output: 'standalone',
  turbopack: {}, // <-- Bùa bình an Vercel đòi đây!
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  webpack: (config: any) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu/**/*',
      'node_modules/@swc/core-linux-x64-musl/**/*',
      'node_modules/@swc/wasm/**/*',
      'node_modules/canvas/**/*',
      'node_modules/pdf-parse/**/*'
    ],
  },
  serverExternalPackages: ['canvas', 'pdf-parse'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;