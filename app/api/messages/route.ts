import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

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

    // Fetch all messages involving the logged-in user
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
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
        receiver: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Fetch all users in system to enable selecting new chat partners
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

    // Auto-seed initial chats if DB messages are empty
    if (messages.length === 0 && systemUsers.length > 0) {
      const firstPartner = systemUsers[0];
      const initialSeed = [
        {
          senderId: firstPartner.id,
          receiverId: userId,
          content: "Chào bạn, mình thấy CV của bạn đăng trên PawBook rất ấn tượng. Bạn có sẵn sàng trao đổi chi tiết công việc không?",
        },
        {
          senderId: userId,
          receiverId: firstPartner.id,
          content: "Dạ chào anh/chị, em luôn sẵn sàng ạ! Anh/chị có thể cho em xin thêm thông tin mô tả chi tiết job được không ạ?",
        },
        {
          senderId: firstPartner.id,
          receiverId: userId,
          content: "Ok em, dự án của tụi anh chủ yếu làm bằng Next.js App Router và tích hợp bot automation. Anh đã gửi link chi tiết qua notification hoặc em check phần Job Board nhé!",
        }
      ];

      await Promise.all(
        initialSeed.map((msg) =>
          prisma.message.create({
            data: msg,
          })
        )
      );

      // Re-fetch
      const refetchedMessages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
        include: {
          sender: {
            select: { id: true, name: true, avatarUrl: true, role: true },
          },
          receiver: {
            select: { id: true, name: true, avatarUrl: true, role: true },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return NextResponse.json({ messages: refetchedMessages, users: systemUsers });
    }

    return NextResponse.json({ messages, users: systemUsers });
  } catch (error: any) {
    console.error("GET messages error:", error);
    return NextResponse.json(
      { error: "Không thể lấy danh sách tin nhắn." },
      { status: 500 }
    );
  }
}

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
    const { receiverId, content } = body;

    if (!receiverId || !content || !content.trim()) {
      return NextResponse.json(
        { error: "Người nhận hoặc nội dung tin nhắn không hợp lệ." },
        { status: 400 }
      );
    }

    // Verify recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Người nhận tin nhắn không tồn tại." },
        { status: 404 }
      );
    }

    const newMessage = await prisma.message.create({
      data: {
        content,
        senderId: userId,
        receiverId,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
        receiver: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
      },
    });

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error: any) {
    console.error("POST message error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi gửi tin nhắn." },
      { status: 550 }
    );
  }
}
