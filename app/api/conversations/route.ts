import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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
