import prisma from "@/lib/prisma";

// Bảng ConversationRead được tạo bằng file SQL chạy tay trên production
// (prisma/sql/2026-10-03_conversation_reads.sql). Nếu code deploy TRƯỚC khi
// bảng tồn tại, mọi truy vấn vào bảng sẽ lỗi "no such table" — các hàm dưới
// đây nuốt lỗi đó và trả giá trị rỗng, để tính năng chưa đọc/đã xem chỉ tạm
// ẩn đi chứ không làm hỏng trang tin nhắn.
function isMissingTable(err: unknown) {
  const msg = String((err as { message?: string })?.message || err);
  return /no such table|does not exist|P2021/i.test(msg);
}

export async function markConversationRead(userId: string, conversationId: string): Promise<Date | null> {
  const now = new Date();
  try {
    await prisma.conversationRead.upsert({
      where: { userId_conversationId: { userId, conversationId } },
      update: { lastReadAt: now },
      create: { userId, conversationId, lastReadAt: now },
    });
    return now;
  } catch (err) {
    if (!isMissingTable(err)) console.error("markConversationRead error:", err);
    return null;
  }
}

// Mốc đọc của TẤT CẢ người tham gia trong các hội thoại cho trước.
export async function getReadMarks(conversationIds: string[]) {
  if (conversationIds.length === 0) return [];
  try {
    return await prisma.conversationRead.findMany({
      where: { conversationId: { in: conversationIds } },
      select: { userId: true, conversationId: true, lastReadAt: true },
    });
  } catch (err) {
    if (!isMissingTable(err)) console.error("getReadMarks error:", err);
    return [];
  }
}

// Thông tin phụ cho danh sách hội thoại — dùng chung cho API /api/messages và
// trang /messages (render phía server), để 2 nơi luôn khớp nhau:
// - unreadCount: tin của người khác gửi sau mốc đã đọc của mình (chưa có mốc
//   → sau tin cuối mình gửi, tức là chưa được trả lời).
// - partnerLastReadAt: mốc đọc mới nhất của người còn lại (cho "Đã xem").
// - lastActiveAt theo userId: mới nhất giữa lần gửi tin cuối và lần đọc cuối.
export async function getConversationMeta(
  userId: string,
  // messages: tin MỚI NHẤT trước (orderBy desc) — chỉ cần tin đầu tiên.
  conversations: { id: string; participants: { id: string }[]; messages?: { senderId: string; createdAt: Date }[] }[]
) {
  const convIds = conversations.map((c) => c.id);
  const marks = await getReadMarks(convIds);
  const myMark = new Map(marks.filter((m) => m.userId === userId).map((m) => [m.conversationId, m.lastReadAt]));
  const otherMarks = marks.filter((m) => m.userId !== userId);

  const myLastSent = convIds.length
    ? await prisma.message.groupBy({
        by: ["conversationId"],
        where: { conversationId: { in: convIds }, senderId: userId },
        _max: { createdAt: true },
      })
    : [];
  const myLastSentByConv = new Map(myLastSent.map((r) => [r.conversationId, r._max.createdAt]));

  // Chỉ đếm (count có index) cho hội thoại CÓ THỂ có tin chưa đọc: tin mới
  // nhất là của người khác và mới hơn mốc đọc của mình. Các hội thoại còn lại
  // chắc chắn = 0 — thường chỉ vài hội thoại phải đếm thay vì tất cả.
  const unreadCounts = await Promise.all(
    conversations.map((conv) => {
      const since = myMark.get(conv.id) ?? myLastSentByConv.get(conv.id) ?? new Date(0);
      const latest = conv.messages?.[0];
      if (latest && (latest.senderId === userId || latest.createdAt <= since)) return 0;
      return prisma.message.count({
        where: { conversationId: conv.id, senderId: { not: userId }, createdAt: { gt: since } },
      });
    })
  );

  const partnerIds = Array.from(
    new Set(conversations.flatMap((c) => c.participants.map((p) => p.id)).filter((id) => id !== userId))
  );
  const lastSent = partnerIds.length
    ? await prisma.message.groupBy({ by: ["senderId"], where: { senderId: { in: partnerIds } }, _max: { createdAt: true } })
    : [];
  const lastActive = new Map<string, Date>();
  for (const row of lastSent) if (row._max.createdAt) lastActive.set(row.senderId, row._max.createdAt);
  for (const m of otherMarks) {
    const prev = lastActive.get(m.userId);
    if (!prev || m.lastReadAt > prev) lastActive.set(m.userId, m.lastReadAt);
  }

  const byConv = new Map(
    convIds.map((id, i) => [
      id,
      {
        unreadCount: unreadCounts[i],
        partnerLastReadAt:
          otherMarks
            .filter((m) => m.conversationId === id)
            .map((m) => m.lastReadAt.toISOString())
            .sort()
            .pop() ?? null,
      },
    ])
  );
  return {
    conv: (id: string) => byConv.get(id) ?? { unreadCount: 0, partnerLastReadAt: null },
    lastActiveAt: (uid: string) => lastActive.get(uid)?.toISOString() ?? null,
  };
}
