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
  // Người nhận đang trong cuộc gọi khác → báo cho người gọi thay vì để họ chờ.
  busy: "call-busy",
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { targetId, action, sdp, candidates, callType, videoOff, callId } = body;

    const eventName = ACTION_TO_EVENT[action];
    if (!targetId || !eventName) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 });
    }

    // Chỉ cần biết userId của người khác (lộ công khai qua /profile/<id>) là
    // gửi được tín hiệu cuộc gọi tới BẤT KỲ ai. Trước đây chỉ chặn ở bước
    // "offer", nên 1 kẻ xấu (kể cả người đã bị chặn) vẫn bắn được
    // reject/candidate/camera vào máy nạn nhân — "reject" chạy cleanupCall()
    // vô điều kiện nên có thể NGẮT cuộc gọi hợp lệ nạn nhân đang nói với
    // người thứ ba (DoS cuộc gọi), còn camera/candidate thì quấy rối/nhiễu
    // kết nối. Áp luật chặn 2 chiều cho MỌI action.
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

    // fromId do SERVER gắn từ session (không phải client khai) — client dùng
    // nó để bỏ qua mọi tín hiệu không đến từ đúng đối phương của cuộc gọi
    // hiện tại, chặn kẻ lạ chèn tín hiệu giả vào cuộc gọi đang diễn ra.
    let payload: Record<string, any>;
    switch (action) {
      case "offer": {
        // Tên + avatar thật từ DB cho màn hình đổ chuông (trước đây chỉ có chữ
        // cái viết tắt).
        const caller = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } });
        payload = {
          fromId: userId,
          callerId: userId,
          callerName: caller?.name || session.user.name || "User",
          callerAvatar: caller?.avatarUrl || null,
          callType: callType === "video" ? "video" : "audio",
          callId: typeof callId === "string" && /^[a-z0-9]{4,16}$/.test(callId) ? callId : "",
        };
        break;
      }
      case "candidate-batch":
        payload = { fromId: userId, candidates };
        break;
      case "accept":
        payload = { fromId: userId, sdp };
        break;
      case "camera":
        payload = { fromId: userId, videoOff };
        break;
      default:
        payload = { fromId: userId };
    }

    await getPusherServer()?.trigger(chatChannelName(String(targetId).trim()), eventName, payload);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Calls API routing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
