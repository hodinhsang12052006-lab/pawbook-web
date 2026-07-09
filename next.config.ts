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
  experimental: {
    serverComponentsExternalPackages: ['canvas'],
  },
  serverExternalPackages: ['canvas'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;