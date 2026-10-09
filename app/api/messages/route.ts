import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { getReadMarks, getConversationMeta } from "@/lib/conversationReads";
import { sendPush } from "@/lib/push";

// GET conversations, messages (filtered by conversationId with cursor), and other system users
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem tin nhắn." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const partnerId = searchParams.get("partnerId");
    const cursor = searchParams.get("cursor") || undefined;
    // Trang đầu đủ lấp màn hình; cuộn lên tải mỗi lần 40 tin (ít lượt chờ mạng hơn, kiểu Telegram).
    const limit = cursor ? 40 : 20;

    let targetConversationId = conversationId;

    if (!targetConversationId && partnerId) {
      // Find conversation containing both users
      const matchedConv = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { id: userId } } },
            { participants: { some: { id: partnerId } } }
          ]
        },
        select: { id: true }
      });
      if (matchedConv) {
        targetConversationId = matchedConv.id;
      } else {
        // No conversation exists yet, return empty list
        return NextResponse.json({
          messages: [],
          nextCursor: null
        });
      }
    }

    // IF fetching on-demand messages for a specific conversation
    if (targetConversationId) {
      // Security check: Verify membership first
      const conversation = await prisma.conversation.findUnique({
        where: { id: targetConversationId },
        include: {
          participants: { select: { id: true } }
        }
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
          { error: "Bạn không có quyền truy cập cuộc trò chuyện này." },
          { status: 403 }
        );
      }

      // `satisfies` (not a `: Prisma.MessageFindManyArgs` annotation) keeps
      // the literal `include` shape intact for Prisma's return-type
      // inference — widening to the general Args interface (or `any`, as
      // this used to be) makes `findMany` fall back to the bare Message
      // type with no `sender`, even though the query itself does include it.
      const queryOptions = {
        where: { conversationId: targetConversationId },
        take: limit + 1,
        orderBy: {
          createdAt: "desc", // Newest first for cursor pagination
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
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      } satisfies Prisma.MessageFindManyArgs;

      const messages = await prisma.message.findMany(queryOptions);

      let nextCursor: string | null = null;
      if (messages.length > limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem!.id;
      }

      // Reverse messages array to return them in chronological order (oldest first)
      const chronMessages = messages.reverse();

      const partner = await prisma.conversation.findUnique({
        where: { id: targetConversationId },
        include: {
          participants: {
            where: { NOT: { id: userId } },
            select: { id: true, name: true, avatarUrl: true, role: true }
          }
        }
      });
      const partnerUser = partner?.participants[0];

      const safeMessages = chronMessages.map((msg) => ({
        id: msg.id,
        content: msg.body,
        type: msg.type || "TEXT",
        senderId: msg.senderId,
        receiverId: partnerUser ? partnerUser.id : "",
        createdAt: msg.createdAt.toISOString(),
        sender: msg.sender ? {
          id: msg.sender.id,
          name: msg.sender.name,
          avatarUrl: msg.sender.avatarUrl,
          role: msg.sender.role,
        } : null,
        receiver: partnerUser || { id: "", name: "User", role: "USER" },
        conversationId: msg.conversationId,
      }));

      // Mốc đã đọc của đối phương → client hiện "Đã xem" dưới tin cuối của mình.
      const marks = await getReadMarks([targetConversationId]);
      const partnerMark = marks.find((m) => m.userId !== userId);

      return NextResponse.json({
        messages: safeMessages,
        nextCursor,
        partnerLastReadAt: partnerMark ? partnerMark.lastReadAt.toISOString() : null,
      });
    }

    // Default list fetch (backward-compatible dashboard payload with conversation previews)
    // Fetch conversations involving the user
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: userId },
        },
      },
      take: 20,
      include: {
        participants: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc", // Get the latest messages for preview
          },
          take: 15, // Preview only the last 15 messages initially
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

    // Chưa đọc / đã xem / hoạt động gần nhất — dữ liệu thật (lib/conversationReads).
    const meta = await getConversationMeta(userId, conversations);

    // Ensure all conversations and nested messages are serialized with safe string dates
    const safeConversations = conversations.map((conv) => {
      // Reverse messages so they are chronologically correct in preview
      const sortedMessages = [...conv.messages].reverse();
      return {
        id: conv.id,
        isGroup: conv.isGroup,
        name: conv.name,
        createdAt: conv.createdAt.toISOString(),
        participants: conv.participants.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          role: p.role,
          lastActiveAt: meta.lastActiveAt(p.id),
        })),
        ...meta.conv(conv.id),
        messages: sortedMessages.map((msg) => ({
          id: msg.id,
          body: msg.body,
          type: msg.type,
          senderId: msg.senderId,
          conversationId: msg.conversationId,
          createdAt: msg.createdAt.toISOString(),
          sender: msg.sender ? {
            id: msg.sender.id,
            name: msg.sender.name,
            avatarUrl: msg.sender.avatarUrl,
            role: msg.sender.role,
          } : null,
        })),
      };
    });

    // Translate database conversations to flat messages array for backwards compatibility
    const flatMessages: any[] = [];
    safeConversations.forEach((conv) => {
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
      },
      take: 100,
    });

    return NextResponse.json({
      messages: flatMessages,
      conversations: safeConversations,
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

    // Accept Text, Image URL, or GIF URL content as-is — no artificial type
    // allowlist or URL-scheme gate. The only real requirement is "not empty".
    const messageText = (content || message || "").toString().trim();
    // Chỉ các loại tin client được phép gửi. Trước đây nhận mọi chuỗi — kẻ
    // xấu gửi type "SYSTEM" sẽ hiện thành dòng "thông báo hệ thống" 🤖 ở giữa
    // khung chat (dễ dùng để lừa đảo: "Tài khoản bị khoá, chuyển tiền…").
    const ALLOWED_TYPES = ["TEXT", "IMAGE", "VIDEO", "STICKER", "CALL"];
    const msgType = typeof type === "string" && ALLOWED_TYPES.includes(type) ? type : "TEXT";

    if (!messageText) {
      return NextResponse.json(
        { error: "Nội dung tin nhắn không thể bỏ trống." },
        { status: 400 }
      );
    }
    // Không giới hạn trước đây — 1 request có thể nhét hàng chục MB vào DB
    // (mỗi lần mở hội thoại lại kéo nguyên khối đó về cho cả 2 bên). Tin
    // ảnh/GIF được nới rộng vì /api/upload trả data URL base64 khi chưa cấu
    // hình Cloudinary.
    const maxLength = msgType === "TEXT" ? 5000 : 2_000_000;
    if (messageText.length > maxLength) {
      return NextResponse.json(
        { error: "Tin nhắn quá dài." },
        { status: 400 }
      );
    }

    // Tin IMAGE/VIDEO được client render thành <img>/<video src=...>. Nếu cho
    // phép URL tùy ý, người gửi có thể nhét 1 URL trỏ về máy chủ của họ —
    // khi người nhận MỞ đoạn chat, trình duyệt tự tải URL đó, LỘ địa chỉ IP
    // và trạng thái online của người nhận cho người gửi (tracking beacon).
    // Ảnh/GIF hợp lệ chỉ đến từ Cloudinary (upload) hoặc Tenor/Giphy (GifPicker)
    // hoặc data URL ảnh (fallback khi chưa cấu hình Cloudinary) — chặn phần còn lại.
    // Nhật ký cuộc gọi do CallManager ghi: "missed:audio", "ended:video:125"…
    if (msgType === "CALL" && !/^(missed|declined|ended):(audio|video)(:\d{1,6})?$/.test(messageText)) {
      return NextResponse.json({ error: "Nhật ký cuộc gọi không hợp lệ." }, { status: 400 });
    }
    if (msgType === "STICKER" && messageText.length > 16) {
      return NextResponse.json({ error: "Sticker không hợp lệ." }, { status: 400 });
    }

    if (msgType === "IMAGE" || msgType === "VIDEO") {
      const ALLOWED_MEDIA = /^(https:\/\/res\.cloudinary\.com\/|https:\/\/[a-z0-9-]+\.tenor\.com\/|https:\/\/media\.tenor\.com\/|https:\/\/[a-z0-9-]+\.giphy\.com\/|data:image\/|data:video\/)/i;
      if (!ALLOWED_MEDIA.test(messageText)) {
        return NextResponse.json(
          { error: "Chỉ chấp nhận ảnh/video tải lên qua ứng dụng." },
          { status: 400 }
        );
      }
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

    // Chặn hoạt động 2 chiều: nếu MỘT trong hai người đã chặn người kia (bất
    // kể ai chặn ai), không ai gửi được tin nhắn mới trong đoạn chat đó nữa.
    // Chỉ áp dụng cho chat 1-1 — nhóm chat không có khái niệm "chặn 1 người"
    // rõ ràng như vậy.
    if (!conversation.isGroup) {
      const otherParticipant = conversation.participants.find((p) => p.id !== userId);
      if (otherParticipant) {
        const blockExists = await prisma.blockedUser.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedUserId: otherParticipant.id },
              { blockerId: otherParticipant.id, blockedUserId: userId },
            ],
          },
        });
        if (blockExists) {
          return NextResponse.json(
            { error: "Không thể gửi tin nhắn — một trong hai người đã chặn." },
            { status: 403 }
          );
        }
      }
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

    // Broadcast to every participant's private channel (not just a single
    // "partner" — that missed everyone else in group chats), using the SAME
    // channel name the client subscribes to (private-chat-<id>). Previously
    // this triggered to the bare user id, which no client ever subscribed to,
    // so new messages never arrived in real time for the recipient.
    try {
      const validChannels = Array.from(
        new Set(
          conversation.participants
            .map((p) => p.id)
            .filter(Boolean)
            .map((id) => chatChannelName(String(id).trim()))
        )
      );

      // Trim the payload (avoid Pusher's 10KB event size limit) — no large
      // fields like base64 avatars.
      const miniPayload = {
        id: formattedMessage.id,
        content: formattedMessage.content,
        senderId: formattedMessage.senderId,
        receiverId: formattedMessage.receiverId || "",
        conversationId: formattedMessage.conversationId,
        createdAt: formattedMessage.createdAt,
        type: formattedMessage.type || "TEXT",
        sender: {
          id: formattedMessage.sender.id,
          name: formattedMessage.sender.name || "User",
        }
      };

      if (validChannels.length > 0) {
        // Client's handler reads `data.message`, so the payload must be nested.
        await getPusherServer()?.trigger(validChannels, "new-message", { message: miniPayload });
      }
      // Thông báo đẩy cho người nhận đang KHÔNG mở app (service worker tự bỏ
      // qua nếu app đang mở). Tag theo hội thoại → nhiều tin chỉ 1 thông báo.
      const recipients = conversation.participants.map((p) => p.id).filter((id) => id && id !== userId);
      if (recipients.length && miniPayload.type !== "CALL") {
        const preview =
          miniPayload.type === "IMAGE" ? "📷 Đã gửi một ảnh" : miniPayload.type === "VIDEO" ? "🎬 Đã gửi một video" : miniPayload.type === "STICKER" ? miniPayload.content : String(miniPayload.content || "");
        sendPush(recipients, {
          title: miniPayload.sender.name,
          body: preview,
          url: `/messages?to=${userId}`,
          tag: `pn-chat-${miniPayload.conversationId}`,
        }).catch(() => {});
      }
    } catch (pusherError: any) {
      console.error("❌ PUSHER LỖI TỪ SERVER:", pusherError?.body || pusherError);
    }

    // Every client call site (handleSendMessage, image upload, GPS check-in)
    // reads `data.message` — returning the bare object here made every
    // successful send throw inside the `res.ok` branch, which the outer
    // catch treated as a network failure and deleted the optimistic bubble,
    // even though the message had already been saved.
    return NextResponse.json({ message: formattedMessage }, { status: 201 });
  } catch (error: any) {
    console.error("POST message error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi gửi tin nhắn." },
      { status: 500 }
    );
  }
}
