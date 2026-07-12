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
    const { messageId, emoji, reactions, partnerId } = body;

    if (!messageId || !partnerId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Tính toán kênh của 2 người chat (giống hệt lúc gửi tin nhắn mới)
    const channels = [String(userId), String(partnerId)].filter(Boolean);

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
