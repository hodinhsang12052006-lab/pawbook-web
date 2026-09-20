import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/block — danh sách userId mà người dùng hiện tại đã chặn (dùng để
// disable khung nhập tin nhắn phía client cho đúng conversation).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const blocks = await prisma.blockedUser.findMany({
      where: { blockerId: session.user.id },
      select: { blockedUserId: true },
    });

    return NextResponse.json({ blockedUserIds: blocks.map((b) => b.blockedUserId) });
  } catch (err) {
    console.error("GET /api/block error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống." }, { status: 500 });
  }
}

// POST /api/block — chặn 1 người dùng (idempotent).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Thiếu userId." }, { status: 400 });
    }
    if (userId === session.user.id) {
      return NextResponse.json({ error: "Không thể tự chặn chính mình." }, { status: 400 });
    }

    await prisma.blockedUser.upsert({
      where: {
        blockerId_blockedUserId: { blockerId: session.user.id, blockedUserId: userId },
      },
      update: {},
      create: { blockerId: session.user.id, blockedUserId: userId },
    });

    return NextResponse.json({ blocked: true });
  } catch (err) {
    console.error("POST /api/block error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi chặn người dùng." }, { status: 500 });
  }
}

// DELETE /api/block?userId=xxx — bỏ chặn.
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Thiếu userId." }, { status: 400 });
    }

    await prisma.blockedUser.deleteMany({
      where: { blockerId: session.user.id, blockedUserId: userId },
    });

    return NextResponse.json({ blocked: false });
  } catch (err) {
    console.error("DELETE /api/block error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi bỏ chặn." }, { status: 500 });
  }
}
