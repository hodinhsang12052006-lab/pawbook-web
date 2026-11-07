"use client";

import PusherClient from "pusher-js";
import type { Channel } from "pusher-js";
import { createChannelKeeper, makeChannelAuthorizer, type ChannelKeeper } from "./pusherResilience";

// Client-only. Kept separate from pusherServer.ts so the Node `pusher` SDK
// never ends up in this module's import graph.
let pusherInstance: PusherClient | null = null;
let keeper: ChannelKeeper | null = null;

export const getPusherClient = () => {
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    console.error("❌ Thiếu cấu hình Pusher Client!");
    return null;
  }

  if (!pusherInstance) {
    const client: PusherClient = new PusherClient(key, {
      cluster: cluster,
      // Own authorizer (same POST /api/pusher/auth): a request timeout + answers for an old socket are dropped.
      // pusher-js' XHR authorizer has no timeout — a hung request left the channel "pending" for good.
      channelAuthorization: { customHandler: makeChannelAuthorizer({ getSocketId: (): string | undefined => client.connection.socket_id }) },
      ...localTestSocket(),
    });
    pusherInstance = client;
    // Re-subscribes after a failed auth / reconnect / app resume (lib/pusherResilience.ts).
    keeper = createChannelKeeper(client, {
      report: (msg, extra) => {
        import("@sentry/nextjs").then((S) => S.captureMessage(msg, { level: "warning", extra })).catch(() => {});
      },
    });
    exposeForLocalQa(client);
  }
  return pusherInstance;
};

/**
 * Subscribe to a channel through the shared keeper (ref-counted; the SAME Channel object for every caller, kept
 * subscribed across failed auths and reconnects). Every acquire needs exactly one releaseChannel. Never call
 * pusher.subscribe()/unsubscribe() directly for a channel the app listens on.
 */
export function acquireChannel(name: string): Channel | null {
  if (!getPusherClient() || !keeper || !name) return null;
  return keeper.acquire(name);
}

export function releaseChannel(name: string): void {
  if (!keeper || !name) return;
  keeper.release(name);
}

/**
 * The app / tab came back (Capacitor App "resume", …): reconnect a dropped socket, ping a possibly half-open one and
 * re-check every channel now. visibilitychange / online / pageshow are handled by the keeper itself.
 */
export function wakeRealtime(reason: string): void {
  if (!getPusherClient() || !keeper) return;
  keeper.wake(reason, { longHidden: reason === "resume" });
}

// LOCAL QA ONLY (scripts/qa/call_test.mjs): a build made with NEXT_PUBLIC_PUSHER_TEST_WS=127.0.0.1:<port> talks to the
// Pusher mock on loopback — and only while the page itself is served from localhost, so even a mistaken production
// build could never send a bitpawos.com visitor's socket anywhere but Pusher.
function localTestSocket() {
  const m = /^(127\.0\.0\.1|localhost):(\d{2,5})$/.exec(process.env.NEXT_PUBLIC_PUSHER_TEST_WS || "");
  if (!m || typeof location === "undefined" || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return {};
  return { wsHost: m[1], wsPort: Number(m[2]), forceTLS: false, enabledTransports: ["ws" as const], disableStats: true };
}

// Read-only keeper state for the local QA harnesses (window.__pnRealtime) — only on a page served from localhost.
function exposeForLocalQa(client: PusherClient) {
  if (typeof window === "undefined" || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  (window as unknown as { __pnRealtime?: unknown }).__pnRealtime = {
    state: () => client.connection.state,
    stats: () => keeper?.stats() ?? [],
    log: () => keeper?.log.slice(-80) ?? [],
  };
}
