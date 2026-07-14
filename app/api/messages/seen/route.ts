import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { pusherServer, chatChannelName } from "@/lib/pusher";

// Ephemeral (non-persisted) read receipts: broadcasts "message-seen" to the
// other participants' private channels so their UI can show "Đã xem" on the
// last message they sent. There's no `seenAt` column on Message (that would
// need a schema migration against the live Turso database), so this is
// session-only — a page refresh loses it. Good enough for a live indicator,
// not for showing seen-status on reload.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { conversationId } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { participants: { select: { id: true } } },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (!conversation.participants.some((p) => p.id === userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const otherChannels = conversation.participants
      .filter((p) => p.id !== userId)
      .map((p) => chatChannelName(p.id));

    const seenAt = new Date().toISOString();
    if (otherChannels.length > 0) {
      await pusherServer.trigger(otherChannels, "message-seen", { conversationId, seenBy: userId, seenAt });
    }

    return NextResponse.json({ success: true, seenAt });
  } catch (error: any) {
    console.error("Mark-seen API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
