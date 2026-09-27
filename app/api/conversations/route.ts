import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    const currentUserId = (session.user as any).id;
    const body = await req.json();
    const { isGroup, name, participantIds } = body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { error: "Danh sách người tham gia không hợp lệ." },
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
          { error: "Không thể tạo cuộc trò chuyện — một trong hai người đã chặn." },
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
      { error: "Không thể tạo cuộc hội thoại." },
      { status: 500 }
    );
  }
}
