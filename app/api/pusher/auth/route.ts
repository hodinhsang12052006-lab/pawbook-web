import { getPusherServer } from "@/lib/pusherServer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.text();
    const params = new URLSearchParams(data);
    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');

    if (!socketId || !channelName) return new NextResponse("Missing data", { status: 400 });

    const pusherServer = getPusherServer();
    if (!pusherServer) return new NextResponse("Pusher chưa được cấu hình trên server.", { status: 503 });

    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("Pusher Auth Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
