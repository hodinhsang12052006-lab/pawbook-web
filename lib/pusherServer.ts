import Pusher from "pusher";

// Server-only — pulls in Node's `crypto`/`https`. Must never be imported
// from a "use client" file (it was previously bundled alongside
// getPusherClient in lib/pusher.ts, which meant this Node-only SDK rode
// along into the client bundle graph of every page that renders <Navbar>).
//
// Built lazily instead of at module load: constructing eagerly meant a
// missing/misconfigured Pusher env var on the server would throw the moment
// this module was imported, taking down every route that imports it (e.g.
// via a shared barrel file) instead of failing only the specific
// request that actually needs to send a realtime event.
let instance: Pusher | null = null;

/**
 * LOCAL QA ONLY: point the SDK at a Pusher-compatible mock on loopback (scripts/qa/lib/pusher_mock.mjs), the same
 * pattern as the other *_ALLOW_TEST flags. Needs PUSHER_ALLOW_TEST=1 + PUSHER_TEST_HOST=127.0.0.1:<port>; refused
 * (and logged) whenever the process runs on Vercel. NEVER set these on Vercel.
 */
export function pusherTestOverride(env: Record<string, string | undefined> = process.env): { host: string; port: number } | null {
  if (env.PUSHER_ALLOW_TEST !== "1") return null;
  if (env.VERCEL || env.VERCEL_ENV) {
    console.error("PUSHER_ALLOW_TEST is set on Vercel — ignored (local QA flag only).");
    return null;
  }
  const m = /^(127\.0\.0\.1|localhost):(\d{2,5})$/.exec(env.PUSHER_TEST_HOST || "");
  return m ? { host: m[1], port: Number(m[2]) } : null;
}

export function getPusherServer(): Pusher | null {
  if (instance) return instance;

  const test = pusherTestOverride();
  const env = process.env;
  const PUSHER_APP_ID = env.PUSHER_APP_ID;
  const PUSHER_SECRET = env.PUSHER_SECRET;
  // Test mock: the key/cluster may come from runtime env (a build made without NEXT_PUBLIC_PUSHER_* still works).
  const NEXT_PUBLIC_PUSHER_APP_KEY = env.NEXT_PUBLIC_PUSHER_APP_KEY || (test ? env.PUSHER_TEST_KEY : undefined);
  const NEXT_PUBLIC_PUSHER_CLUSTER = env.NEXT_PUBLIC_PUSHER_CLUSTER || (test ? "mt1" : undefined);
  if (!PUSHER_APP_ID || !NEXT_PUBLIC_PUSHER_APP_KEY || !PUSHER_SECRET || !NEXT_PUBLIC_PUSHER_CLUSTER) {
    console.error("❌ Thiếu cấu hình Pusher Server (PUSHER_APP_ID/KEY/SECRET/CLUSTER) — bỏ qua realtime event.");
    return null;
  }

  try {
    instance = new Pusher({
      appId: PUSHER_APP_ID,
      key: NEXT_PUBLIC_PUSHER_APP_KEY,
      secret: PUSHER_SECRET,
      cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
      useTLS: !test,
      ...(test ? { host: test.host, port: test.port } : {}),
    });
    return instance;
  } catch (err) {
    console.error("❌ Khởi tạo Pusher Server thất bại:", err);
    return null;
  }
}
