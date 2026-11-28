// Danh sách chat xếp theo HOẠT ĐỘNG GẦN NHẤT (tin nhắn mới nhất), không theo ngày tạo cuộc trò chuyện.
// Lỗi cũ: lấy N cuộc mới TẠO nhất → người có nhiều cuộc trò chuyện (tài khoản chính thức: mỗi người đăng ký có 1 cuộc
// chào mừng; chủ tiệm nhắn nhiều thợ) không thấy tin mới trong cuộc trò chuyện cũ — cuộc đó không nằm trong N cuộc.
// Không đổi schema: tin mới nhất mỗi cuộc lấy bằng groupBy trên Message (có index conversationId + createdAt).
import prisma from "@/lib/prisma";

/** id các cuộc trò chuyện của userId, mới hoạt động nhất trước (tin mới nhất; cuộc chưa có tin → theo ngày tạo). */
export async function recentConversationIds(userId: string, take: number): Promise<string[]> {
  const mine = { participants: { some: { id: userId } } };
  const [active, empty] = await Promise.all([
    prisma.message.groupBy({
      by: ["conversationId"],
      where: { conversation: mine },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
      take,
    }),
    prisma.conversation.findMany({ where: { ...mine, messages: { none: {} } }, orderBy: { createdAt: "desc" }, take: Math.min(take, 10), select: { id: true, createdAt: true } }),
  ]);
  const rows = [
    ...active.map((r) => ({ id: r.conversationId, at: r._max.createdAt?.getTime() ?? 0 })),
    ...empty.map((c) => ({ id: c.id, at: c.createdAt.getTime() })),
  ];
  rows.sort((a, b) => b.at - a.at);
  return [...new Set(rows.map((r) => r.id))].slice(0, take);
}

/** Xếp lại kết quả findMany theo đúng thứ tự id (findMany với `id in` không giữ thứ tự). */
export function inIdOrder<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
}
