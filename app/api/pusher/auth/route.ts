import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
    const pusherServer = getPusherServer();
    if (!pusherServer) return new NextResponse("Pusher chưa được cấu hình trên server.", { status: 503 });

    // Trạng thái online thật: mỗi người có 1 presence channel
    // "presence-user-<id>". Ai đang mở app thì là thành viên kênh của chính
    // mình; người khác "nhìn" kênh đó để biết họ có online không. Chỉ cho xem
    // trạng thái của người ĐÃ TỪNG nhắn tin chung (không cho dò online của
    // người lạ) và không phải khi 2 bên đã chặn nhau.
    const presenceMatch = /^presence-user-([a-z0-9]+)$/i.exec(channelName);
    if (presenceMatch) {
      const targetId = presenceMatch[1];
      if (targetId !== session.user.id) {
        const [shared, blocked] = await Promise.all([
          prisma.conversation.findFirst({
            where: {
              AND: [
                { participants: { some: { id: session.user.id } } },
                { participants: { some: { id: targetId } } },
              ],
            },
            select: { id: true },
          }),
          prisma.blockedUser.findFirst({
            where: {
              OR: [
                { blockerId: session.user.id, blockedUserId: targetId },
                { blockerId: targetId, blockedUserId: session.user.id },
              ],
            },
            select: { id: true },
          }),
        ]);
        if (!shared || blocked) {
          return new NextResponse("Forbidden — không có quyền xem trạng thái người này.", { status: 403 });
        }
      }
      const presenceAuth = pusherServer.authorizeChannel(socketId, channelName, {
        user_id: session.user.id,
        user_info: {},
      });
      return NextResponse.json(presenceAuth);
    }

    if (channelName !== chatChannelName(session.user.id)) {
      return new NextResponse("Forbidden — không có quyền truy cập kênh này.", { status: 403 });
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("Pusher Auth Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
