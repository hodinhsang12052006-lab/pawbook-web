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

export function getPusherServer(): Pusher | null {
  if (instance) return instance;

  const { PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_APP_KEY, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_CLUSTER } = process.env;
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
      useTLS: true,
    });
    return instance;
  } catch (err) {
    console.error("❌ Khởi tạo Pusher Server thất bại:", err);
    return null;
  }
}
