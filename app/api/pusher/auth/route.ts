import { pusherServer } from "@/lib/pusher";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.text();
    const params = new URLSearchParams(data);
    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');
    
    if (!socketId || !channelName) return new NextResponse("Missing data", { status: 400 });
    
    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("Pusher Auth Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
