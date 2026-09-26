import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/jobs/saved — danh sách id các tin đã lưu của người dùng hiện tại
// (trả về mảng id gọn nhẹ, không phải full Job — JobBoard đã có sẵn data
// đầy đủ của từng tin, chỉ cần biết cái nào đã lưu để tô đậm nút bookmark).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const saved = await prisma.savedJob.findMany({
      where: { userId },
      select: { jobId: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(saved.map((s) => s.jobId));
  } catch (error: any) {
    console.error("Fetch saved jobs API error:", error);
    return NextResponse.json({ error: "Không thể tải danh sách tin đã lưu." }, { status: 500 });
  }
}
