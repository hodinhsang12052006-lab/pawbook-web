import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import Pusher from "pusher";

// BỘ LỌC CHỐNG LỖI COPY-PASTE (Xóa ngoặc kép và khoảng trắng)
const clean = (val?: string) => (val || "").replace(/['"]/g, "").trim();

// 1. KHỞI TẠO PUSHER (Có fallback cứng để chống Vercel Cache)
const pusherServer = new Pusher({
  appId: clean(process.env.PUSHER_APP_ID) || "2175600",
  key: clean(process.env.NEXT_PUBLIC_PUSHER_APP_KEY) || "c0aeac77207466ef74e9",
  secret: clean(process.env.PUSHER_SECRET) as string,
  cluster: clean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER) || "ap1",
  useTLS: true,
});

// GET all conversations, messages, and other system users
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem tin nhắn." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    // Fetch conversations involving the user
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: userId },
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            bio: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Translate database conversations to flat messages array for backwards compatibility
    const flatMessages: any[] = [];
    conversations.forEach((conv) => {
      conv.messages.forEach((msg) => {
        const partner = conv.participants.find((p) => p.id !== msg.senderId);
        flatMessages.push({
          id: msg.id,
          content: msg.body,
          type: msg.type || "TEXT",
          senderId: msg.senderId,
          receiverId: partner ? partner.id : "",
          createdAt: msg.createdAt,
          sender: msg.sender,
          receiver: partner || { id: "", name: "User", role: "USER" },
          conversationId: conv.id,
        });
      });
    });

    // Fetch other system users to enable selecting new chat partners
    const systemUsers = await prisma.user.findMany({
      where: {
        NOT: {
          id: userId,
        },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        role: true,
        bio: true,
      },
    });

    return NextResponse.json({
      messages: flatMessages,
      conversations,
      users: systemUsers,
    });
  } catch (error: any) {
    console.error("GET messages error:", error);
    return NextResponse.json(
      { error: "Không thể lấy danh sách tin nhắn." },
      { status: 500 }
    );
  }
}

// POST send new message (supports both conversationId and old receiverId)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để gửi tin nhắn." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { receiverId, content, message, conversationId, type } = body;

    const messageText = content || message || "";
    const msgType = type || "TEXT"; // TEXT, IMAGE, VIDEO

    if (!messageText.trim()) {
      return NextResponse.json(
        { error: "Nội dung tin nhắn không thể bỏ trống." },
        { status: 400 }
      );
    }

    let activeConversationId = conversationId;

    // Fallback: Find or create conversation by receiverId if conversationId is not provided
    if (!activeConversationId && receiverId) {
      // Find existing conversation between the two users
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { id: userId } } },
            { participants: { some: { id: receiverId } } },
          ],
        },
      });

      if (existing) {
        activeConversationId = existing.id;
      } else {
        // Create new conversation
        const createdConv = await prisma.conversation.create({
          data: {
            participants: {
              connect: [{ id: userId }, { id: receiverId }],
            },
          },
        });
        activeConversationId = createdConv.id;
      }
    }

    if (!activeConversationId) {
      return NextResponse.json(
        { error: "Mã cuộc trò chuyện (conversationId) hoặc người nhận (receiverId) không hợp lệ." },
        { status: 400 }
      );
    }

    // Security check: Only members are allowed to read/write messages in this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: activeConversationId },
      include: {
        participants: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Cuộc trò chuyện không tồn tại." },
        { status: 404 }
      );
    }

    const isMember = conversation.participants.some((p) => p.id === userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Bạn không có thẩm quyền trong cuộc trò chuyện này." },
        { status: 403 }
      );
    }

    // Create the message in database
    const createdMessage = await prisma.message.create({
      data: {
        body: messageText,
        type: msgType,
        senderId: userId,
        conversationId: activeConversationId,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
      },
    });

    const partner = conversation.participants.find((p) => p.id !== userId);

    const formattedMessage = {
      id: createdMessage.id,
      content: createdMessage.body,
      type: createdMessage.type,
      senderId: createdMessage.senderId,
      receiverId: partner ? partner.id : "",
      createdAt: createdMessage.createdAt,
      sender: createdMessage.sender,
      receiver: partner || { id: "", name: "User", role: "USER" },
      conversationId: activeConversationId,
    };

    // 🚀 2. BẮN TÍN HIỆU (Gộp kênh và ép kiểu Payload siêu nhẹ)
    try {
      // Gom kênh người gửi và người nhận, loại bỏ khoảng trắng rác
      const channels = [String(userId).trim()];
      if (partner && partner.id) {
        channels.push(String(partner.id).trim());
      }

      // ÉP KIỂU JSON: Tẩy rửa sạch sẽ các Object ẩn của Database để tránh lỗi 400 Payload Too Large
      const safePayload = JSON.parse(JSON.stringify(formattedMessage));
      
      console.log(`🚀 [BACKEND] Bắn Pusher tới các kênh:`, channels);
      
      // Bắn 1 phát ăn 2 kênh luôn cho tối ưu
      await pusherServer.trigger(channels, "new-message", safePayload);
      
      console.log("✅ [BACKEND] Bắn Pusher THÀNH CÔNG RỰC RỠ!");
    } catch (pusherError: any) {
      // In ra chi tiết tận răng xem Pusher nó chửi cái gì
      console.error("❌ PUSHER ERROR CHI TIẾT:", pusherError?.body || pusherError);
    }

    return NextResponse.json(formattedMessage, { status: 201 });
  } catch (error: any) {
    console.error("POST message error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi gửi tin nhắn." },
      { status: 500 }
    );
  }
}
