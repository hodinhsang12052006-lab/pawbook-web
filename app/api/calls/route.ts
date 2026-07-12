import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Pusher from "pusher";

const clean = (val?: string) => (val || "").replace(/['"]/g, "").trim();

const pusherServer = new Pusher({
  appId: clean(process.env.PUSHER_APP_ID) || "2175600",
  key: clean(process.env.NEXT_PUBLIC_PUSHER_APP_KEY) || "c0aeac77207466ef74e9",
  secret: clean(process.env.PUSHER_SECRET) as string,
  cluster: clean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER) || "ap1",
  useTLS: true,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { to, type, signal, callerName, callType } = body;

    if (!to || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Broadcast signaling event via Pusher to target user's personal channel
    const eventName = type; // incoming-call, call-accepted, call-rejected, ice-candidate
    const payload = {
      from: userId,
      callerName: callerName || session.user.name || "User",
      signal,
      callType,
    };

    console.log(`📡 [CALL SIGNAL] Broadcasting event ${eventName} to channel ${to} from ${userId}`);
    await pusherServer.trigger(String(to).trim(), eventName, payload);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Calls API routing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
