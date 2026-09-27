import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import prisma from "@/lib/prisma";

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

    // Chỉ cần biết userId của người khác (lộ công khai qua /profile/<id>) là
    // trước đây gọi được API này để đổ chuông/gửi tín hiệu cuộc gọi tới BẤT
    // KỲ ai — kể cả người đã chủ động Chặn mình. Áp cùng luật chặn 2 chiều
    // như /api/messages, chỉ ở bước khởi tạo cuộc gọi ("offer") vì đó là véc-tơ
    // quấy rối thật (đổ chuông giả liên tục); các action tiếp theo trong cùng
    // 1 cuộc gọi (accept/candidate/camera) không cần lặp lại kiểm tra này.
    if (action === "offer") {
      const blockExists = await prisma.blockedUser.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedUserId: targetId },
            { blockerId: targetId, blockedUserId: userId },
          ],
        },
      });
      if (blockExists) {
        return NextResponse.json({ error: "Không thể gọi — một trong hai người đã chặn." }, { status: 403 });
      }
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

    await getPusherServer()?.trigger(chatChannelName(String(targetId).trim()), eventName, payload);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Calls API routing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
