import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = (session.user as any).id;

    // Pusher client sends data as application/x-www-form-urlencoded
    const text = await req.text();
    const params = new URLSearchParams(text);
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");

    if (!socketId || !channelName) {
      return new Response("Missing Pusher socket_id or channel_name", { status: 400 });
    }

    // Security check: Only allow users to subscribe to their own private chat channel
    // Format is: private-chat-<userId>
    const expectedChannel = `private-chat-${userId}`;
    if (channelName !== expectedChannel) {
      return new Response("Forbidden: You can only subscribe to your own private channel", { status: 403 });
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: userId,
      user_info: {
        name: session.user.name,
        email: session.user.email,
      },
    });

    return NextResponse.json(authResponse);
  } catch (error: any) {
    console.error("Pusher auth error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
