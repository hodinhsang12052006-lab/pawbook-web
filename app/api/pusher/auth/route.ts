import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.text();
    const params = new URLSearchParams(data);
    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');

    if (!socketId || !channelName) return new NextResponse("Missing data", { status: 400 });

    // Trước đây route này authorize BẤT KỲ channel_name nào mà client yêu
    // cầu mà không kiểm tra ai đang đăng nhập — bất kỳ user nào (chỉ cần
    // biết userId của người khác, vốn lộ công khai qua URL /profile/<id>)
    // đều có thể tự construct channel_name="private-chat-<victim-id>" và
    // được cấp quyền nghe lén toàn bộ tin nhắn/tín hiệu cuộc gọi realtime
    // của người đó. Kênh "private-chat-<userId>" chỉ được authorize nếu
    // đúng là chủ sở hữu userId đó đang gọi.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (channelName === chatChannelName(session.user.id)) {
      // Kênh cá nhân của chính người đang đăng nhập — hợp lệ.
    } else {
      return new NextResponse("Forbidden — không có quyền truy cập kênh này.", { status: 403 });
    }

    const pusherServer = getPusherServer();
    if (!pusherServer) return new NextResponse("Pusher chưa được cấu hình trên server.", { status: 503 });

    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("Pusher Auth Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
