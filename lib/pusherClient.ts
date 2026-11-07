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
      ...localTestSocket(),
    });
  }
  return pusherInstance;
};

// LOCAL QA ONLY (scripts/qa/call_test.mjs): a build made with NEXT_PUBLIC_PUSHER_TEST_WS=127.0.0.1:<port> talks to the
// Pusher mock on loopback — and only while the page itself is served from localhost, so even a mistaken production
// build could never send a bitpawos.com visitor's socket anywhere but Pusher.
function localTestSocket() {
  const m = /^(127\.0\.0\.1|localhost):(\d{2,5})$/.exec(process.env.NEXT_PUBLIC_PUSHER_TEST_WS || "");
  if (!m || typeof location === "undefined" || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return {};
  return { wsHost: m[1], wsPort: Number(m[2]), forceTLS: false, enabledTransports: ["ws" as const], disableStats: true };
}
