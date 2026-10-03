import prisma from "@/lib/prisma";

// Lượt xem thật của bài đăng (bảng PostStat, tạo bằng
// prisma/sql/2026-10-03_post_stats.sql). Giống lib/conversationReads: khi
// bảng chưa tồn tại thì trả rỗng / bỏ qua, không làm hỏng bảng tin.
function isMissingTable(err: unknown) {
  return /no such table|does not exist|P2021/i.test(String((err as { message?: string })?.message || err));
}

export async function getViews(postIds: string[]): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();
  try {
    const rows = await prisma.postStat.findMany({ where: { postId: { in: postIds } }, select: { postId: true, views: true } });
    return new Map(rows.map((r) => [r.postId, r.views]));
  } catch (err) {
    if (!isMissingTable(err)) console.error("getViews error:", err);
    return new Map();
  }
}

export async function addViews(postIds: string[]): Promise<boolean> {
  try {
    await Promise.all(
      postIds.map((postId) =>
        prisma.postStat.upsert({
          where: { postId },
          update: { views: { increment: 1 } },
          create: { postId, views: 1 },
        })
      )
    );
    return true;
  } catch (err) {
    // Bài đã bị xoá (khoá ngoại) hoặc bảng chưa có — bỏ qua.
    if (!isMissingTable(err)) console.error("addViews error:", err);
    return false;
  }
}
