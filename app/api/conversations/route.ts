import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { groupCreateBlocked } from "@/lib/abuseGuard";
import { errorEn } from "@/lib/i18n/apiErrorsEn";
import { getConversationMeta } from "@/lib/conversationReads";

// GET /api/conversations?id=<conversationId> — 1 cuộc trò chuyện của chính mình, cùng dạng với danh sách ở trang
// /messages (app/[lang]/messages/page.tsx). Dùng khi mở /messages?c=<id> (bấm thông báo / bong bóng chat) mà cuộc trò
// chuyện đó chưa có trong danh sách đã tải (trang chỉ tải 50 cuộc mới tạo nhất).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ error: "Mã cuộc trò chuyện không hợp lệ.", errorEn: "Invalid conversation." }, { status: 400 });
  try {
    // Chỉ thành viên mới thấy (không phân biệt "không tồn tại" với "không có quyền" → không dò được id của người khác).
    const conv = await prisma.conversation.findFirst({
      where: { id, participants: { some: { id: userId } } },
      include: {
        participants: { select: { id: true, name: true, avatarUrl: true, role: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!conv) return NextResponse.json({ error: "Không tìm thấy cuộc trò chuyện.", errorEn: "Conversation not found." }, { status: 404 });
    const meta = await getConversationMeta(userId, [conv]);
    return NextResponse.json({
      conversation: {
        id: conv.id,
        isGroup: conv.isGroup,
        name: conv.name || null,
        createdAt: conv.createdAt.toISOString(),
        participants: conv.participants.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl || null, role: p.role, lastActiveAt: meta.lastActiveAt(p.id) })),
        ...meta.conv(conv.id),
        messages: conv.messages.map((m) => ({ id: m.id, body: m.body, type: m.type, senderId: m.senderId, conversationId: m.conversationId, createdAt: m.createdAt.toISOString() })),
      },
    });
  } catch (error) {
    console.error("GET conversation error:", error);
    return NextResponse.json({ error: "Không tải được cuộc trò chuyện.", errorEn: "Couldn't load the conversation." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập.", errorEn: "Please log in." },
        { status: 401 }
      );
    }

    const currentUserId = (session.user as any).id;
    const body = await req.json();
    const { isGroup, name, participantIds } = body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0 || participantIds.some((id: unknown) => typeof id !== "string")) {
      return NextResponse.json(
        { error: "Danh sách người tham gia không hợp lệ.", errorEn: "Invalid list of participants." },
        { status: 400 }
      );
    }

    // Include current user in the participants list
    const uniqueIds = Array.from(new Set([...participantIds, currentUserId]));
    const otherIds = uniqueIds.filter((id) => id !== currentUserId);

    // /api/messages đã chặn gửi tin nhắn 2 chiều nếu 1 trong 2 người đã
    // chặn nhau, nhưng CHỈ áp dụng cho chat 1-1 (comment gốc ở đó ghi rõ
    // "nhóm chat không có khái niệm chặn 1 người rõ ràng") — nghĩa là người
    // bị chặn có thể lách bằng cách tạo một NHÓM chứa cả mình và người đã
    // chặn mình, phá vỡ hoàn toàn tính năng Chặn (vốn dựng lên để đáp ứng
    // yêu cầu compliance của Apple/Google). Chặn việc TẠO bất kỳ hội thoại
    // nào — 1-1 hay nhóm — nếu người tạo và bất kỳ ai trong đó đã chặn nhau.
    if (otherIds.length > 0) {
      const blockExists = await prisma.blockedUser.findFirst({
        where: {
          OR: [
            { blockerId: currentUserId, blockedUserId: { in: otherIds } },
            { blockedUserId: currentUserId, blockerId: { in: otherIds } },
          ],
        },
      });
      if (blockExists) {
        return NextResponse.json(
          { error: "Không thể tạo cuộc trò chuyện — một trong hai người đã chặn.", errorEn: "You can't start a conversation with this person." },
          { status: 403 }
        );
      }
    }

    // 1-to-1 Conversation
    if (!isGroup && uniqueIds.length === 2) {
      const otherUserId = uniqueIds.find(id => id !== currentUserId);

      // Check existing 1-to-1 conversation
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { id: currentUserId } } },
            { participants: { some: { id: otherUserId } } },
          ],
        },
        include: {
          participants: {
            select: { id: true, name: true, avatarUrl: true, role: true },
          },
        },
      });

      if (existing) {
        return NextResponse.json(existing);
      }
    }

    // Chống spam: nhóm chat kéo hàng trăm người vào rồi rải tin (lib/abuseGuard).
    if (isGroup || uniqueIds.length > 2) {
      const capped = await groupCreateBlocked(currentUserId, uniqueIds.length);
      if (capped) return NextResponse.json({ error: capped, errorEn: errorEn(capped) }, { status: 429 });
    }

    // Create new conversation (Group or 1-to-1)
    const newConversation = await prisma.conversation.create({
      data: {
        isGroup: !!isGroup,
        name: isGroup ? (name || "Nhóm trò chuyện mới") : null,
        participants: {
          connect: uniqueIds.map(id => ({ id })),
        },
      },
      include: {
        participants: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
      },
    });

    return NextResponse.json(newConversation, { status: 201 });
  } catch (error: any) {
    console.error("Create conversation error:", error);
    return NextResponse.json(
      { error: "Không thể tạo cuộc hội thoại.", errorEn: "Couldn't start the conversation." },
      { status: 500 }
    );
  }
}
