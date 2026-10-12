import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { REACTION_EMOJIS } from "@/lib/chatReactions";

// POST /api/messages/react { messageId, emoji } — thả cảm xúc kiểu Messenger, LƯU THẬT:
//   mỗi người 1 cảm xúc / tin · chọn cảm xúc khác = đổi · bấm lại đúng cảm xúc đang có = gỡ.
// Trả về + bắn realtime danh sách đầy đủ [{ e, u }] để 2 máy hiện giống nhau.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const messageId = typeof body?.messageId === "string" ? body.messageId : "";
    const emoji = typeof body?.emoji === "string" ? body.emoji : "";
    if (!messageId || !emoji) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Kiểm tra người gọi thuộc cuộc trò chuyện chứa tin này (không tin partnerId client gửi).
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversation: { select: { participants: { select: { id: true } } } } },
    });
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (!message.conversation.participants.some((p) => p.id === userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Chỉ bộ cảm xúc có sẵn — chặn nhét chuỗi tuỳ ý vào tin của người khác (kiểm tra SAU quyền: người
    // ngoài luôn nhận 403, tin không tồn tại luôn 404, dù gửi emoji gì).
    if (!REACTION_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: "Cảm xúc không hợp lệ" }, { status: 400 });
    }

    const key = { messageId_userId: { messageId, userId } };
    const existing = await prisma.messageReaction.findUnique({ where: key, select: { emoji: true } });
    if (existing?.emoji === emoji) {
      await prisma.messageReaction.delete({ where: key });
    } else {
      await prisma.messageReaction.upsert({ where: key, update: { emoji, createdAt: new Date() }, create: { messageId, userId, emoji } });
    }

    const rows = await prisma.messageReaction.findMany({ where: { messageId }, orderBy: { createdAt: "asc" }, select: { emoji: true, userId: true } });
    const reactions = rows.map((r) => ({ e: r.emoji, u: r.userId }));
    const channels = Array.from(new Set(message.conversation.participants.map((p) => chatChannelName(p.id))));
    await getPusherServer()?.trigger(channels, "message-updated", { id: messageId, reactions }).catch(() => {});

    return NextResponse.json({ reactions });
  } catch (error) {
    console.error("Reaction API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
