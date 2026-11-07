import crypto from "node:crypto";
import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { getReadMarks, getConversationMeta } from "@/lib/conversationReads";
import { sendPush, type PushPayload } from "@/lib/push";
import { chatPushAvatar, chatPushTitle, chatPushUrl } from "@/lib/chatPush";
import { coldDmBlocked } from "@/lib/abuseGuard";
import { errorEn } from "@/lib/i18n/apiErrorsEn";
import { isAllowedStickerId, serverStickerGlyph } from "@/lib/stickers/server";
import { isGifUrl } from "@/lib/chat/gif";

// GET conversations, messages (filtered by conversationId with cursor), and other system users
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem tin nhắn.", errorEn: "Log in to see your messages." },
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
          { error: "Cuộc trò chuyện không tồn tại.", errorEn: "This conversation doesn't exist." },
          { status: 404 }
        );
      }

      const isMember = conversation.participants.some((p) => p.id === userId);
      if (!isMember) {
        return NextResponse.json(
          { error: "Bạn không có quyền truy cập cuộc trò chuyện này.", errorEn: "You don't have access to this conversation." },
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
          reactions: { select: { emoji: true, userId: true }, orderBy: { createdAt: "asc" } },
        },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      } satisfies Prisma.MessageFindManyArgs;

      const messages = await prisma.message.findMany(queryOptions);

      // Con trỏ = tin CUỐI CÙNG được trả về (cũ nhất của trang này); trang sau dùng cursor + skip:1 nên bắt đầu
      // ngay sau nó. Trước đây con trỏ là hàng thừa (limit+1) bị bỏ đi → hàng đó không bao giờ được trả về:
      // mất 1 tin mỗi trang (tin thứ 21, rồi cứ 41 tin lại mất 1).
      let nextCursor: string | null = null;
      if (messages.length > limit) {
        messages.pop();
        nextCursor = messages[messages.length - 1]!.id;
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
        reactions: msg.reactions.map((r) => ({ e: r.emoji, u: r.userId })),
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
      { error: "Không thể lấy danh sách tin nhắn.", errorEn: "Couldn't load messages." },
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
        { error: "Vui lòng đăng nhập để gửi tin nhắn.", errorEn: "Log in to send messages." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { receiverId, content, message, conversationId, type } = body;
    // Mã tin do máy khách tạo (crypto.randomUUID) — gửi lại cùng mã (mạng chập chờn, hàng chờ offline) không tạo tin trùng.
    const clientId = typeof body.clientId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.clientId) ? (body.clientId as string) : null;

    // Accept Text, Image URL, or GIF URL content as-is — no artificial type
    // allowlist or URL-scheme gate. The only real requirement is "not empty".
    const messageText = (content || message || "").toString().trim();
    // Chỉ các loại tin client được phép gửi. Trước đây nhận mọi chuỗi — kẻ
    // xấu gửi type "SYSTEM" sẽ hiện thành dòng "thông báo hệ thống" 🤖 ở giữa
    // khung chat (dễ dùng để lừa đảo: "Tài khoản bị khoá, chuyển tiền…").
    const ALLOWED_TYPES = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "STICKER", "CALL"];
    const msgType = typeof type === "string" && ALLOWED_TYPES.includes(type) ? type : "TEXT";

    if (!messageText) {
      return NextResponse.json(
        { error: "Nội dung tin nhắn không thể bỏ trống.", errorEn: "Write a message first." },
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
        { error: "Tin nhắn quá dài.", errorEn: "This message is too long." },
        { status: 400 }
      );
    }

    // Tin IMAGE/VIDEO được client render thành <img>/<video src=...>. Nếu cho
    // phép URL tùy ý, người gửi có thể nhét 1 URL trỏ về máy chủ của họ —
    // khi người nhận MỞ đoạn chat, trình duyệt tự tải URL đó, LỘ địa chỉ IP
    // và trạng thái online của người nhận cho người gửi (tracking beacon).
    // Ảnh/GIF hợp lệ chỉ đến từ Cloudinary (upload) hoặc GIPHY / Tenor (tab GIF, qua /api/gifs)
    // hoặc data URL ảnh (fallback khi chưa cấu hình Cloudinary) — chặn phần còn lại.
    // Nhật ký cuộc gọi do CallManager ghi: "missed:audio", "ended:video:125"…
    if (msgType === "CALL" && !/^(missed|declined|ended):(audio|video)(:\d{1,6})?$/.test(messageText)) {
      return NextResponse.json({ error: "Nhật ký cuộc gọi không hợp lệ.", errorEn: "Invalid call log." }, { status: 400 });
    }
    // Sticker: CHỈ id có trong danh mục (lib/stickers/server.ts — Noto: ký tự emoji; Fluent 3D: "fl:<tên thư mục>").
    if (msgType === "STICKER" && !isAllowedStickerId(messageText)) {
      return NextResponse.json({ error: "Sticker không hợp lệ.", errorEn: "Invalid sticker." }, { status: 400 });
    }

    // Tin thoại: chỉ file ghi âm đã tải lên Cloudinary của PawNail (kèm "#d=<giây>" để hiện thời lượng).
    if (msgType === "AUDIO" && !/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/video\/upload\/[^\s"'<>#]+(#d=\d{1,3}(&w=[A-Za-z0-9_-]{1,64})?)?$/i.test(messageText)) {
      return NextResponse.json({ error: "Tin nhắn thoại không hợp lệ.", errorEn: "Invalid voice message." }, { status: 400 });
    }
    if (msgType === "IMAGE" || msgType === "VIDEO") {
      const ALLOWED_MEDIA = /^(https:\/\/res\.cloudinary\.com\/|https:\/\/[a-z0-9-]+\.tenor\.com\/|https:\/\/media\.tenor\.com\/|https:\/\/[a-z0-9-]+\.giphy\.com\/|data:image\/|data:video\/)/i;
      if (!ALLOWED_MEDIA.test(messageText)) {
        return NextResponse.json(
          { error: "Chỉ chấp nhận ảnh/video tải lên qua ứng dụng.", errorEn: "Photos and videos must be uploaded through the app." },
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
        // Chống spam: mở cuộc trò chuyện MỚI với người lạ có giới hạn / ngày (lib/abuseGuard).
        if (typeof receiverId !== "string" || receiverId === userId) {
          return NextResponse.json({ error: "Người nhận không hợp lệ.", errorEn: "Invalid recipient." }, { status: 400 });
        }
        const capped = await coldDmBlocked(userId);
        if (capped) return NextResponse.json({ error: capped, errorEn: errorEn(capped), code: "COLD_DM_LIMIT" }, { status: 429 });
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
        { error: "Mã cuộc trò chuyện (conversationId) hoặc người nhận (receiverId) không hợp lệ.", errorEn: "Invalid conversation or recipient." },
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
        { error: "Cuộc trò chuyện không tồn tại.", errorEn: "This conversation doesn't exist." },
        { status: 404 }
      );
    }

    const isMember = conversation.participants.some((p) => p.id === userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Bạn không có thẩm quyền trong cuộc trò chuyện này.", errorEn: "You don't have permission to do that in this conversation." },
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
            { error: "Không thể gửi tin nhắn — một trong hai người đã chặn.", errorEn: "You can't message this person." },
            { status: 403 }
          );
        }
      }
    }

    // Chống spam: tin ĐẦU TIÊN trong cuộc trò chuyện 1-1 vừa mở (qua /api/conversations) cũng tính là
    // "nhắn người lạ" — chỉ kiểm tra với cuộc trò chuyện mới (< 24h) để chat thường không tốn thêm truy vấn.
    if (!conversation.isGroup && conversationId && Date.now() - new Date(conversation.createdAt).getTime() < 86_400_000) {
      const hasAny = await prisma.message.findFirst({ where: { conversationId: activeConversationId }, select: { id: true } });
      if (!hasAny) {
        const capped = await coldDmBlocked(userId);
        if (capped) return NextResponse.json({ error: capped, errorEn: errorEn(capped), code: "COLD_DM_LIMIT" }, { status: 429 });
      }
    }

    // GỬI NHANH: tạo sẵn id + giờ gửi, rồi BẮN realtime cho người nhận SONG SONG với lúc ghi DB
    // (trước đây: ghi DB xong mới bắn → người nhận chờ thêm cả 1 vòng ghi DB). Lỡ ghi DB lỗi
    // (hiếm) thì bắn "message-recalled" để máy người nhận gỡ tin vừa hiện.
    const msgId = clientId
      ? "c" + crypto.createHash("sha256").update(`${userId}:${clientId}`).digest("hex").slice(0, 24)
      : "c" + crypto.randomBytes(12).toString("hex");
    const createdAt = new Date();
    const partner = conversation.participants.find((p) => p.id !== userId);
    const me = conversation.participants.find((p) => p.id === userId);
    const sender = { id: userId, name: me?.name || (session.user as any).name || "User", avatarUrl: me?.avatarUrl ?? null, role: me?.role ?? "USER" };

    // Broadcast to every participant's private channel (not just a single
    // "partner" — that missed everyone else in group chats), using the SAME
    // channel name the client subscribes to (private-chat-<id>).
    const validChannels = Array.from(
      new Set(
        conversation.participants
          .map((p) => p.id)
          .filter(Boolean)
          .map((id) => chatChannelName(String(id).trim()))
      )
    );
    // Trim the payload (avoid Pusher's 10KB event size limit) — no large
    // fields like base64 avatars. Client's handler reads `data.message`.
    const miniPayload = {
      id: msgId,
      content: messageText,
      senderId: userId,
      receiverId: partner ? partner.id : "",
      conversationId: activeConversationId,
      createdAt,
      type: msgType,
      sender: { id: userId, name: sender.name },
      ...(clientId ? { clientId } : {}),
    };
    const pusher = getPusherServer();
    const delivery = validChannels.length && pusher
      ? pusher.trigger(validChannels, "new-message", { message: miniPayload }).catch((e: any) => console.error("❌ PUSHER LỖI TỪ SERVER:", e?.body || e))
      : Promise.resolve();

    let createdMessage;
    try {
      createdMessage = await prisma.message.create({
        data: { id: msgId, createdAt, body: messageText, type: msgType, senderId: userId, conversationId: activeConversationId },
        select: { id: true, body: true, type: true, senderId: true, createdAt: true },
      });
    } catch (dbError) {
      await delivery;
      // Cùng clientId đã lưu rồi (gửi lại) → trả tin cũ, KHÔNG gỡ tin (tin thật đang hiện bên người nhận), không đẩy thông báo lần 2.
      if (clientId && (dbError as { code?: string })?.code === "P2002") {
        const existing = await prisma.message.findUnique({ where: { id: msgId }, select: { id: true, body: true, type: true, senderId: true, createdAt: true, conversationId: true } });
        if (existing && existing.senderId === userId) {
          return NextResponse.json({
            message: { id: existing.id, content: existing.body, type: existing.type, senderId: existing.senderId, receiverId: partner ? partner.id : "", createdAt: existing.createdAt, sender, receiver: partner || { id: "", name: "User", role: "USER" }, conversationId: existing.conversationId, clientId },
            duplicate: true,
          }, { status: 200 });
        }
      }
      await pusher?.trigger(validChannels, "message-recalled", { id: msgId, conversationId: activeConversationId }).catch(() => {});
      throw dbError;
    }
    await delivery; // đã chạy song song — chờ nốt để hàm không bị dừng trước khi bắn xong

    const formattedMessage = {
      id: createdMessage.id,
      content: createdMessage.body,
      type: createdMessage.type,
      senderId: createdMessage.senderId,
      receiverId: partner ? partner.id : "",
      createdAt: createdMessage.createdAt,
      sender,
      receiver: partner || { id: "", name: "User", role: "USER" },
      conversationId: activeConversationId,
      ...(clientId ? { clientId } : {}),
    };

    // Thông báo đẩy cho người nhận đang KHÔNG mở app (service worker tự bỏ
    // qua nếu app đang mở). Tag theo hội thoại → nhiều tin chỉ 1 thông báo.
    const recipients = conversation.participants.map((p) => p.id).filter((id) => id && id !== userId);
    if (recipients.length && msgType !== "CALL") {
      const gif = msgType === "IMAGE" && isGifUrl(messageText);
      const glyph = msgType === "STICKER" ? serverStickerGlyph(messageText) || "" : "";
      const preview =
        gif ? "Đã gửi một GIF" : msgType === "IMAGE" ? "📷 Đã gửi một ảnh" : msgType === "VIDEO" ? "🎬 Đã gửi một video" : msgType === "AUDIO" ? "🎤 Đã gửi một tin nhắn thoại" : msgType === "STICKER" ? `${glyph} Nhãn dán`.trim() : messageText;
      const previewEn =
        gif ? "Sent a GIF" : msgType === "IMAGE" ? "📷 Sent a photo" : msgType === "VIDEO" ? "🎬 Sent a video" : msgType === "AUDIO" ? "🎤 Sent a voice message" : msgType === "STICKER" ? `${glyph} Sticker`.trim() : messageText;
      // Tiêu đề hội thoại: tên nhóm (nhóm) / tên người gửi (1-1). Dạng thông báo cũ (web, iPhone, app Android cũ)
      // ghi "Người gửi · Nhóm" để người nhận biết tin đến từ nhóm nào; app Android mới tự vẽ kiểu Messenger từ `chat`.
      const chatTitle = chatPushTitle(conversation, sender.name);
      const payload: PushPayload = {
        title: conversation.isGroup ? `${sender.name} · ${chatTitle}` : sender.name,
        body: preview,
        url: chatPushUrl(activeConversationId),
        tag: `pn-chat-${activeConversationId}`,
        en: { body: previewEn },
        chat: {
          cid: activeConversationId,
          mid: createdMessage.id,
          senderId: userId,
          senderName: sender.name,
          avatar: chatPushAvatar(sender.avatarUrl),
          group: !!conversation.isGroup,
          title: chatTitle,
          ts: new Date(createdMessage.createdAt).getTime(),
        },
      };
      // after(): gửi SAU khi trả lời nhưng giữ hàm serverless sống tới khi xong (fire-and-forget có thể bị Vercel cắt
      // giữa lượt lấy token / gọi FCM → mất thông báo).
      after(() => sendPush(recipients, payload).catch(() => 0));
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
      { error: "Đã xảy ra lỗi hệ thống khi gửi tin nhắn.", errorEn: "Couldn't send the message. Please try again." },
      { status: 500 }
    );
  }
}
