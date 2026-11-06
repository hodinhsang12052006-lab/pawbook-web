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
      return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
    }

    const blocks = await prisma.blockedUser.findMany({
      where: { blockerId: session.user.id },
      select: { blockedUserId: true },
    });

    return NextResponse.json({ blockedUserIds: blocks.map((b) => b.blockedUserId) });
  } catch (err) {
    console.error("GET /api/block error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống.", errorEn: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// POST /api/block — chặn 1 người dùng (idempotent).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Thiếu userId.", errorEn: "Missing user." }, { status: 400 });
    }
    if (userId === session.user.id) {
      return NextResponse.json({ error: "Không thể tự chặn chính mình.", errorEn: "You can't block yourself." }, { status: 400 });
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
    return NextResponse.json({ error: "Lỗi hệ thống khi chặn người dùng.", errorEn: "Couldn't block this user. Please try again." }, { status: 500 });
  }
}

// DELETE /api/block?userId=xxx — bỏ chặn.
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
    }

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Thiếu userId.", errorEn: "Missing user." }, { status: 400 });
    }

    await prisma.blockedUser.deleteMany({
      where: { blockerId: session.user.id, blockedUserId: userId },
    });

    return NextResponse.json({ blocked: false });
  } catch (err) {
    console.error("DELETE /api/block error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi bỏ chặn.", errorEn: "Couldn't unblock. Please try again." }, { status: 500 });
  }
}
