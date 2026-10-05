import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { isPlaceholderAvatar } from "@/lib/avatar";

// GET /api/onboarding — 3 việc đầu tiên giúp người mới có KẾT QUẢ ngay tuần
// đầu (thợ: bật báo việc, 3 ảnh mẫu, nhắn tiệm đầu tiên; chủ tiệm: đăng tin,
// nhắn thợ đầu tiên, hoàn thiện hồ sơ tiệm). Tính từ dữ liệu thật — không
// lưu cờ riêng, tự "tích" khi người dùng làm xong ở bất cứ đâu.
const safeCount = async (fn: () => Promise<number>) => {
  try {
    return await fn();
  } catch {
    return 0; // bảng mới chưa tạo (VD JobAlert) → coi như chưa làm
  }
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, createdAt: true, avatarUrl: true, turnSplitPolicy: true, technicianProfile: { select: { portfolioImages: true } } },
  });
  if (!user || user.role === "ADMIN") return NextResponse.json({ steps: [], newUser: false });

  const sent = await safeCount(() => prisma.message.count({ where: { senderId: userId } }));
  let steps: { key: string; done: boolean }[];
  if (user.role === "OWNER") {
    const jobs = await safeCount(() => prisma.job.count({ where: { ownerId: userId } }));
    steps = [
      { key: "post_job", done: jobs > 0 },
      { key: "message_tech", done: sent > 0 },
      { key: "salon_profile", done: !isPlaceholderAvatar(user.avatarUrl) && !!user.turnSplitPolicy },
    ];
  } else {
    const alerts = await safeCount(() => prisma.jobAlert.count({ where: { userId } }));
    let photos = 0;
    try {
      photos = (JSON.parse(user.technicianProfile?.portfolioImages || "[]") as unknown[]).length;
    } catch {}
    steps = [
      { key: "job_alert", done: alerts > 0 },
      { key: "portfolio", done: photos >= 3 },
      { key: "message_salon", done: sent > 0 },
    ];
  }
  // "Người mới" = tạo tài khoản trong 14 ngày — sau đó thẻ tự ẩn dù chưa xong.
  const newUser = Date.now() - user.createdAt.getTime() < 14 * 86_400_000;
  return NextResponse.json({ role: user.role, steps, newUser }, { headers: { "Cache-Control": "private, no-store" } });
}
