// Bộ cảm xúc thả vào tin nhắn (dùng chung client + máy chủ).
export const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🙏", "👍", "💅"];

export interface Reaction {
  e: string; // emoji
  u: string; // userId
}

/** [{e,u}] → nhóm theo emoji (nhiều người nhất trước) + tổng số + cảm xúc của mình. */
export function summarize(list: Reaction[] | undefined, me: string) {
  const all = list ?? [];
  const counts = new Map<string, number>();
  for (const r of all) counts.set(r.e, (counts.get(r.e) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  return { top, total: all.length, mine: all.find((r) => r.u === me)?.e ?? null };
}

/** Bấm 1 cảm xúc: trùng cái đang có → gỡ; khác → đổi; chưa có → thêm (giống máy chủ, để hiện ngay). */
export function toggleReaction(list: Reaction[] | undefined, me: string, emoji: string): Reaction[] {
  const rest = (list ?? []).filter((r) => r.u !== me);
  const mine = (list ?? []).find((r) => r.u === me);
  return mine?.e === emoji ? rest : [...rest, { e: emoji, u: me }];
}
