import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thực hiện Đẩy Top bài đăng." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: "Tham số truyền vào không hợp lệ (thiếu loại hoặc mã bài đăng)." },
        { status: 400 }
      );
    }

    // 1. Fetch user to check coin balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Người dùng không tồn tại." },
        { status: 404 }
      );
    }

    if (user.pawCoin < 500) {
      return NextResponse.json(
        { error: `Số dư PawCoin không đủ (Cần 500 Coin, hiện có ${user.pawCoin} Coin). Hãy tích cực bình luận, hoàn thành CV hoặc cày thầu để kiếm thêm!` },
        { status: 400 }
      );
    }

    // 2. Resolve target item and check ownership
    let updatedItem: any = null;
    const boostUntilDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    if (type === "job") {
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) return NextResponse.json({ error: "Không tìm thấy tin tuyển dụng." }, { status: 404 });
      if (job.employerId !== userId && user.role !== "ADMIN") {
        return NextResponse.json({ error: "Bạn không có quyền quản trị tin tuyển dụng này." }, { status: 403 });
      }

      // Update in transaction
      const [updatedUser, boostedJob] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { pawCoin: { decrement: 500 } },
        }),
        prisma.job.update({
          where: { id },
          data: { isBoosted: true, boostUntil: boostUntilDate },
        }),
        prisma.transaction.create({
          data: {
            userId,
            amount: -500,
            type: "EXPENSE",
            description: `Đẩy Top tin tuyển dụng: "${job.title.substring(0, 20)}..."`,
          },
        }),
        prisma.notification.create({
          data: {
            userId,
            title: "Trừ PawCoin 💸",
            message: `Bạn vừa dùng 500 PawCoin đẩy top tin tuyển dụng "${job.title.substring(0, 25)}...".`,
            type: "WALLET",
            link: "/?tab=jobs",
          },
        }),
      ]);
      updatedItem = boostedJob;

    } else if (type === "service") {
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) return NextResponse.json({ error: "Không tìm thấy gian hàng dịch vụ." }, { status: 404 });
      if (service.ownerId !== userId && user.role !== "ADMIN") {
        return NextResponse.json({ error: "Bạn không có quyền quản trị gian hàng này." }, { status: 403 });
      }

      // Update in transaction
      const [updatedUser, boostedService] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { pawCoin: { decrement: 500 } },
        }),
        prisma.service.update({
          where: { id },
          data: { isBoosted: true, boostUntil: boostUntilDate },
        }),
        prisma.transaction.create({
          data: {
            userId,
            amount: -500,
            type: "EXPENSE",
            description: `Đẩy Top gian hàng: "${service.name.substring(0, 20)}..."`,
          },
        }),
        prisma.notification.create({
          data: {
            userId,
            title: "Trừ PawCoin 💸",
            message: `Bạn vừa dùng 500 PawCoin đẩy top gian hàng dịch vụ "${service.name.substring(0, 25)}...".`,
            type: "WALLET",
            link: "/services",
          },
        }),
      ]);
      updatedItem = boostedService;

    } else if (type === "gig") {
      const gig = await prisma.gig.findUnique({ where: { id } });
      if (!gig) return NextResponse.json({ error: "Không tìm thấy dự án thời vụ." }, { status: 404 });
      if (gig.employerId !== userId && user.role !== "ADMIN") {
        return NextResponse.json({ error: "Bạn không có quyền quản trị dự án này." }, { status: 403 });
      }

      // Update in transaction
      const [updatedUser, boostedGig] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { pawCoin: { decrement: 500 } },
        }),
        prisma.gig.update({
          where: { id },
          data: { isBoosted: true, boostUntil: boostUntilDate },
        }),
        prisma.transaction.create({
          data: {
            userId,
            amount: -500,
            type: "EXPENSE",
            description: `Đẩy Top thầu dự án: "${gig.title.substring(0, 20)}..."`,
          },
        }),
        prisma.notification.create({
          data: {
            userId,
            title: "Trừ PawCoin 💸",
            message: `Bạn vừa dùng 500 PawCoin đẩy top thầu dự án "${gig.title.substring(0, 25)}...".`,
            type: "WALLET",
            link: "/gigs",
          },
        }),
      ]);
      updatedItem = boostedGig;

    } else {
      return NextResponse.json({ error: "Loại bài đăng đẩy thầu không hợp lệ." }, { status: 400 });
    }

    return NextResponse.json({
      message: `Đẩy top bài đăng thành công! Đã khấu trừ 500 PawCoin. Hạn đẩy top đến ngày ${boostUntilDate.toLocaleDateString("vi-VN")}.`,
      item: updatedItem,
    });
  } catch (error: any) {
    console.error("Boost API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi đẩy thầu bài đăng." },
      { status: 500 }
    );
  }
}
