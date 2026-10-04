import prisma from "@/lib/prisma";
import { findQuestion, PULSE_MIN_VOTES } from "@/lib/painPulse";

export interface PulseResult {
  questionId: string;
  question: string;
  topic: string;
  week: string;
  total: number;
  published: boolean; // đủ mẫu để công bố %
  options: { id: string; label: string; votes: number; pct: number }[];
  top: { label: string; pct: number } | null;
  scope: string | null; // bang (nếu lọc theo bang)
}

function isMissingTable(err: unknown) {
  return /no such table|does not exist|P2021/i.test(String((err as { message?: string })?.message || err));
}

/** Kết quả 1 câu hỏi trong 1 tuần (tuỳ chọn lọc thị trường / bang). */
export async function pulseResult(questionId: string, week: string, filter: { market?: string; state?: string } = {}): Promise<PulseResult | null> {
  const q = findQuestion(questionId);
  if (!q) return null;
  const counts = new Map<string, number>();
  try {
    const votes = await prisma.pulseVote.findMany({
      where: { week, questionId, ...(filter.market ? { market: filter.market } : {}), ...(filter.state ? { state: filter.state } : {}) },
      select: { option: true },
      take: 50_000,
    });
    for (const v of votes) counts.set(v.option, (counts.get(v.option) ?? 0) + 1);
  } catch (err) {
    if (!isMissingTable(err)) console.error("pulseResult error:", err);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  const options = q.options.map((op) => {
    const votes = counts.get(op.id) ?? 0;
    return { id: op.id, label: op.label, votes, pct: total ? Math.round((votes / total) * 100) : 0 };
  });
  const sorted = [...options].sort((a, b) => b.votes - a.votes);
  const published = total >= PULSE_MIN_VOTES;
  return {
    questionId, question: q.question, topic: q.topic, week, total, published, options,
    top: published && sorted[0].votes > 0 ? { label: sorted[0].label, pct: sorted[0].pct } : null,
    scope: filter.state ?? null,
  };
}
