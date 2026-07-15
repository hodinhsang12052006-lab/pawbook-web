import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { pusherServer, chatChannelName } from "@/lib/pusher";

// Maps the client's call `action` (MessagesContent.tsx's handleStartCall /
// handleAcceptCall / handleEndCall / camera toggle) to the Pusher event name
// the client's channel.bind() calls actually listen for. The two were
// previously named differently on each side ({to, type, signal} here vs
// {targetId, action, sdp, candidate} sent by the client), so no call
// signaling ever reached the client — offers, answers, and ICE candidates
// were all silently dropped.
const ACTION_TO_EVENT: Record<string, string> = {
  offer: "incoming-call",
  "candidate-batch": "call-candidate-batch",
  accept: "call-accepted",
  reject: "call-rejected",
  camera: "camera-status",
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { targetId, action, sdp, candidates, callType, videoOff } = body;

    const eventName = ACTION_TO_EVENT[action];
    if (!targetId || !eventName) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 });
    }

    let payload: Record<string, any>;
    switch (action) {
      case "offer":
        payload = { callerId: userId, callerName: session.user.name || "User", callType, sdp };
        break;
      case "candidate-batch":
        payload = { candidates };
        break;
      case "accept":
        payload = { sdp };
        break;
      case "camera":
        payload = { videoOff };
        break;
      default:
        payload = {};
    }

    await pusherServer.trigger(chatChannelName(String(targetId).trim()), eventName, payload);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Calls API routing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
