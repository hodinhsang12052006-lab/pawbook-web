import Pusher from "pusher";
import PusherClient from "pusher-js";

// Single source of truth for the per-user private channel name. The client
// subscribes to this exact name (see getPusherClient usage in
// MessagesContent.tsx) — every server-side trigger() MUST target this same
// name, or the event is sent to a channel nobody is listening on and silently
// disappears (this was previously the case for new-message/message-updated/
// call signaling, which triggered to the bare user id instead).
export const chatChannelName = (userId: string) => `private-chat-${userId}`;

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID as string,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY as string,
  secret: process.env.PUSHER_SECRET as string,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string,
  useTLS: true,
});

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
