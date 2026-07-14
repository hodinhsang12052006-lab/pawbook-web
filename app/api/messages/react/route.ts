import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { pusherServer, chatChannelName } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messageId, emoji, reactions } = body;

    if (!messageId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Resolve the actual conversation participants from the message itself
    // instead of trusting the client-supplied partnerId — for group chats
    // that field is a conversation id, not a user id, so it can't be turned
    // directly into a channel name.
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversation: { select: { participants: { select: { id: true } } } } },
    });
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const channels = Array.from(
      new Set(message.conversation.participants.map((p) => chatChannelName(p.id)))
    );

    const updatedMessage = {
      id: messageId,
      reactions: reactions || [],
      emoji: emoji,
    };

    // Bắn sự kiện "message-updated" kèm theo tin nhắn đã có reaction mới
    await pusherServer.trigger(channels, "message-updated", updatedMessage);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reaction API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
