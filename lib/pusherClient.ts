"use client";

import PusherClient from "pusher-js";

// Client-only. Kept separate from pusherServer.ts so the Node `pusher` SDK
// never ends up in this module's import graph.
let pusherInstance: PusherClient | null = null;

export const getPusherClient = () => {
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    console.error("❌ Thiếu cấu hình Pusher Client!");
    return null;
  }

  if (!pusherInstance) {
    pusherInstance = new PusherClient(key, {
      cluster: cluster,
      authEndpoint: "/api/pusher/auth",
    });
  }
  return pusherInstance;
};
