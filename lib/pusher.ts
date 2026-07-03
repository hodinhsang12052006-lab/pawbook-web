import PusherServer from "pusher";
import PusherClient from "pusher-js";

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID || "1800000",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "a1b2c3d4e5f6g7h8i9j0",
  secret: process.env.PUSHER_SECRET || "s1e2c3r4e5t6",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1",
  useTLS: true,
});

// Configure client instance (using global singleton check to prevent duplicate client connections during Fast Refresh)
let pusherClientInstance: PusherClient | null = null;

export const getPusherClient = (): PusherClient => {
  if (typeof window === "undefined") {
    return null as any;
  }
  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(
      process.env.NEXT_PUBLIC_PUSHER_KEY || "a1b2c3d4e5f6g7h8i9j0",
      {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1",
      }
    );
  }
  return pusherClientInstance;
};
