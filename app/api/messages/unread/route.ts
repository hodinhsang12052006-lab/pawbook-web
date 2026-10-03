import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getConversationMeta } from "@/lib/conversationReads";

// GET /api/messages/unread — tổng số tin chưa đọc thật cho badge Navbar
// (trước đây badge chỉ đếm tin đến TRONG phiên đang mở, tải lại trang là về 0).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { id: userId } } },
      take: 50,
      select: {
        id: true,
        participants: { select: { id: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true, createdAt: true } },
      },
    });
    const meta = await getConversationMeta(userId, conversations);
    const counts = conversations.map((c) => meta.conv(c.id).unreadCount);
    return NextResponse.json({ unread: counts.reduce((a, b) => a + b, 0) });
  } catch (error) {
    console.error("GET /api/messages/unread error:", error);
    return NextResponse.json({ unread: 0 }, { status: 500 });
  }
}
