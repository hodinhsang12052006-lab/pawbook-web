import Pusher from "pusher";
import PusherClient from "pusher-js";

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
    PusherClient.logToConsole = true; // Ép hiện Log để theo dõi
    pusherInstance = new PusherClient(key, {
      cluster: cluster,
      authEndpoint: "/api/pusher/auth",
    });
  }
  return pusherInstance;
};
