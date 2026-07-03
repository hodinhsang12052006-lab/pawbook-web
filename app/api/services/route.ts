import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: [
        { isBoosted: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            bio: true,
          },
        },
      },
    });

    return NextResponse.json(services);
  } catch (error: any) {
    console.error("Fetch services API error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách dịch vụ." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng ký dịch vụ." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin người dùng." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, category, description, location, contactInfo } = body;

    if (!name || !category || !description || !location || !contactInfo) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ các thông tin bắt buộc." },
        { status: 400 }
      );
    }

    const newService = await prisma.service.create({
      data: {
        name,
        category,
        description,
        location,
        contactInfo,
        ownerId: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            bio: true,
          },
        },
      },
    });

    return NextResponse.json(newService, { status: 201 });
  } catch (error: any) {
    console.error("Create service API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi thêm dịch vụ." },
      { status: 500 }
    );
  }
}
