import prisma from "@/lib/prisma";

// Thời gian phản hồi tin nhắn THẬT của 1 người (thường là chủ tiệm): với mỗi
// lượt người khác nhắn tới mà người này chưa trả lời, đo tới tin trả lời kế
// tiếp của họ trong cùng hội thoại. Lấy trung vị 60 ngày gần nhất — trung vị
// để 1 lần trả lời trễ không kéo lệch cả con số.

export interface ResponseStats {
  medianMinutes: number;
  samples: number;
}

const WINDOW_MS = 60 * 86_400_000;
const MAX_WAIT_MS = 3 * 86_400_000; // trả lời sau 3 ngày thì không tính là "phản hồi"
const MIN_SAMPLES = 3;
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: ResponseStats | null }>();

export async function getResponseStats(userId: string): Promise<ResponseStats | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let value: ResponseStats | null = null;
  try {
    const since = new Date(Date.now() - WINDOW_MS);
    const msgs = await prisma.message.findMany({
      where: {
        createdAt: { gte: since },
        conversation: { isGroup: false, participants: { some: { id: userId } } },
      },
      select: { conversationId: true, senderId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 2000,
    });

    const pendingSince = new Map<string, number>(); // conversationId → lúc người kia bắt đầu chờ
    const deltas: number[] = [];
    for (const m of msgs) {
      const t = m.createdAt.getTime();
      if (m.senderId !== userId) {
        if (!pendingSince.has(m.conversationId)) pendingSince.set(m.conversationId, t);
      } else {
        const start = pendingSince.get(m.conversationId);
        if (start !== undefined) {
          if (t - start <= MAX_WAIT_MS) deltas.push(t - start);
          pendingSince.delete(m.conversationId);
        }
      }
    }
    if (deltas.length >= MIN_SAMPLES) {
      deltas.sort((a, b) => a - b);
      const mid = deltas[Math.floor(deltas.length / 2)];
      value = { medianMinutes: Math.max(1, Math.round(mid / 60_000)), samples: deltas.length };
    }
  } catch (err) {
    console.error("getResponseStats error:", err);
  }
  cache.set(userId, { at: Date.now(), value });
  return value;
}

/** "trong vài phút" / "trong ~40 phút" / "trong ~3 giờ" / "trong 1 ngày". */
export function describeResponse(minutes: number): string {
  if (minutes <= 10) return "trong vài phút";
  if (minutes < 60) return `trong ~${Math.round(minutes / 5) * 5} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `trong ~${hours} giờ`;
  return "trong 1 ngày";
}
