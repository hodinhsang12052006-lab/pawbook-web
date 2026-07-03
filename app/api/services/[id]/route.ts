import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Dịch vụ hoặc cửa hàng không tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json(service);
  } catch (error: any) {
    console.error("GET service detail error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy thông tin chi tiết dịch vụ." },
      { status: 500 }
    );
  }
}
