import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";

// POST /api/messages/typing — báo "đang soạn tin…" cho những người còn lại
// trong hội thoại. Client tự giới hạn ~1 lần/3 giây; server chỉ kiểm tra
// thành viên + chặn 2 chiều rồi bắn sự kiện realtime (không ghi DB).
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { conversationId } = await req.json().catch(() => ({}));
    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true, participants: { select: { id: true } } },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (!conversation.participants.some((p) => p.id === userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const others = conversation.participants.map((p) => p.id).filter((id) => id !== userId);
    if (!conversation.isGroup && others.length === 1) {
      const blocked = await prisma.blockedUser.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedUserId: others[0] },
            { blockerId: others[0], blockedUserId: userId },
          ],
        },
        select: { id: true },
      });
      if (blocked) return NextResponse.json({ success: true });
    }

    if (others.length > 0) {
      await getPusherServer()?.trigger(others.map(chatChannelName), "user-typing", {
        conversationId,
        userId,
        name: session.user.name || "",
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Typing API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
