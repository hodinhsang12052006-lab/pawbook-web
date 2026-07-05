import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

// GET bookings list (both sent and received requests)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem yêu cầu." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    // Fetch received bookings (where user is the owner/employer)
    const received = await prisma.booking.findMany({
      where: { receiverId: userId },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true, role: true, phone: true }
        },
        job: { select: { id: true, title: true } },
        service: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // Fetch sent bookings (where user is the client/candidate)
    const sent = await prisma.booking.findMany({
      where: { senderId: userId },
      include: {
        receiver: {
          select: { id: true, name: true, avatarUrl: true, role: true, phone: true }
        },
        job: { select: { id: true, title: true } },
        service: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ received, sent });
  } catch (error: any) {
    console.error("GET bookings error:", error);
    return NextResponse.json(
      { error: "Không thể lấy danh sách yêu cầu." },
      { status: 500 }
    );
  }
}

// POST create a new booking request
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để gửi yêu cầu." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { jobId, serviceId, message } = body;

    if (!jobId && !serviceId) {
      return NextResponse.json(
        { error: "Mã bài đăng công việc hoặc dịch vụ không hợp lệ." },
        { status: 400 }
      );
    }

    let receiverId = "";

    if (jobId) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { employerId: true }
      });
      if (!job) {
        return NextResponse.json(
          { error: "Bài tuyển dụng không tồn tại." },
          { status: 404 }
        );
      }
      receiverId = job.employerId;
    } else if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { ownerId: true }
      });
      if (!service) {
        return NextResponse.json(
          { error: "Gian hàng dịch vụ không tồn tại." },
          { status: 404 }
        );
      }
      receiverId = service.ownerId;
    }

    if (userId === receiverId) {
      return NextResponse.json(
        { error: "Bạn không thể tự gửi yêu cầu cho chính mình." },
        { status: 400 }
      );
    }

    const newBooking = await prisma.booking.create({
      data: {
        jobId: jobId || null,
        serviceId: serviceId || null,
        senderId: userId,
        receiverId,
        message: message || "",
        status: "PENDING"
      }
    });

    // Automatically send a system notification to the receiver
    try {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          title: "Yêu cầu đặt đơn mới 📅",
          message: `Bạn nhận được yêu cầu mới từ ${session.user.name}: "${message || "không có lời nhắn"}".`,
          type: "INFO",
          link: "/profile"
        }
      });
    } catch (notifErr) {
      console.error("Failed to trigger booking system notification:", notifErr);
    }

    return NextResponse.json(newBooking, { status: 201 });
  } catch (error: any) {
    console.error("POST booking error:", error);
    return NextResponse.json(
      { error: "Không thể tạo yêu cầu." },
      { status: 500 }
    );
  }
}

// PATCH update booking status
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để cập nhật yêu cầu." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { bookingId, status } = body;

    if (!bookingId || !status) {
      return NextResponse.json(
        { error: "Thông tin cập nhật không hợp lệ." },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Yêu cầu đặt đơn không tồn tại." },
        { status: 404 }
      );
    }

    // Security checks: Only receiver can ACCEPT/REJECT. Sender or receiver can COMPLETE.
    if (status === "ACCEPTED" || status === "REJECTED") {
      if (booking.receiverId !== userId) {
        return NextResponse.json(
          { error: "Bạn không có quyền phản hồi yêu cầu này." },
          { status: 403 }
        );
      }
    } else if (status === "COMPLETED") {
      if (booking.receiverId !== userId && booking.senderId !== userId) {
        return NextResponse.json(
          { error: "Bạn không có quyền cập nhật trạng thái hoàn thành." },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Trạng thái cập nhật không hợp lệ." },
        { status: 400 }
      );
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status }
    });

    // Notify the sender about the response
    try {
      const statusText = status === "ACCEPTED" ? "đồng ý nhận đơn" : (status === "REJECTED" ? "từ chối" : "hoàn thành");
      await prisma.notification.create({
        data: {
          userId: booking.senderId,
          title: "Cập nhật yêu cầu đặt đơn 📢",
          message: `Đối tác đã ${statusText} yêu cầu đặt đơn của bạn.`,
          type: "INFO",
          link: "/profile"
        }
      });
    } catch (notifErr) {
      console.error("Failed to notify user about booking update:", notifErr);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH booking error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật trạng thái đặt đơn." },
      { status: 500 }
    );
  }
}
