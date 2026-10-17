// Chống spam / lừa đảo hàng loạt (kiểm tra bảo mật 17/10/2026). Đếm thẳng trong DB (không dùng bộ đếm
// trong RAM — Vercel chạy nhiều máy chủ, RAM mỗi máy riêng nên bộ đếm RAM lách được).
// Chỉ chặn hành vi "lạ hàng loạt", KHÔNG chặn chat bình thường:
//  • Nhắn LẦN ĐẦU cho người lạ (mở cuộc trò chuyện mới): tối đa 20 người/ngày với tài khoản < 3 ngày tuổi,
//    60 người/ngày với tài khoản cũ. Trả lời / nhắn tiếp trong cuộc trò chuyện đã có thì không giới hạn.
//  • Nhóm chat: tối đa GROUP_MAX_MEMBERS người / nhóm, GROUPS_PER_DAY nhóm / ngày.
//  • Tin tuyển thợ: tối đa JOBS_PER_DAY tin / 24 giờ cho 1 chủ tiệm.
// Tài khoản ADMIN (tài khoản chính thức gửi lời chào) không bị giới hạn.
import prisma from "@/lib/prisma";

const DAY = 86_400_000;
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
export const coldDmCap = (young: boolean) => (young ? num(process.env.COLD_DM_DAILY_NEW, 20) : num(process.env.COLD_DM_DAILY, 60));
export const GROUP_MAX_MEMBERS = 20;
export const GROUPS_PER_DAY = 5;
export const jobsPerDay = () => num(process.env.JOBS_PER_DAY, 10);

async function who(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { role: true, createdAt: true } });
}

/** Đã mở quá nhiều cuộc trò chuyện mới với người lạ trong 24h → trả câu báo lỗi; còn lượt → null. */
export async function coldDmBlocked(userId: string): Promise<string | null> {
  const me = await who(userId);
  if (!me || me.role === "ADMIN") return null;
  const cap = coldDmCap(Date.now() - new Date(me.createdAt).getTime() < 3 * DAY);
  const convs = await prisma.conversation.findMany({
    where: { isGroup: false, createdAt: { gte: new Date(Date.now() - DAY) }, participants: { some: { id: userId } } },
    select: { messages: { take: 1, orderBy: { createdAt: "asc" }, select: { senderId: true } } },
    take: cap * 4 + 50,
  });
  const started = convs.filter((c) => c.messages[0]?.senderId === userId).length;
  return started >= cap
    ? `Hôm nay bạn đã nhắn cho ${started} người mới — để chống tin rác, mai bạn nhắn tiếp người mới nhé. Các cuộc trò chuyện đang có vẫn nhắn bình thường.`
    : null;
}

/** Tạo nhóm chat: chặn nhóm quá đông / tạo quá nhiều nhóm trong ngày. */
export async function groupCreateBlocked(userId: string, members: number): Promise<string | null> {
  if (members > GROUP_MAX_MEMBERS) return `Nhóm tối đa ${GROUP_MAX_MEMBERS} người.`;
  const me = await who(userId);
  if (!me || me.role === "ADMIN") return null;
  // Nhóm không lưu người tạo → đếm nhóm mới có mình tham gia mà tin đầu tiên do mình gửi, cộng nhóm còn trống.
  const groups = await prisma.conversation.findMany({
    where: { isGroup: true, createdAt: { gte: new Date(Date.now() - DAY) }, participants: { some: { id: userId } } },
    select: { messages: { take: 1, orderBy: { createdAt: "asc" }, select: { senderId: true } } },
    take: 200,
  });
  const mine = groups.filter((g) => !g.messages[0] || g.messages[0].senderId === userId).length;
  return mine >= GROUPS_PER_DAY ? `Hôm nay bạn đã tạo ${GROUPS_PER_DAY} nhóm — mai tạo tiếp nhé.` : null;
}

/** Chủ tiệm đăng quá nhiều tin tuyển trong 24h. */
export async function jobPostBlocked(userId: string): Promise<string | null> {
  const me = await who(userId);
  if (!me || me.role === "ADMIN") return null;
  const n = await prisma.job.count({ where: { ownerId: userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
  return n >= jobsPerDay()
    ? `Mỗi tiệm đăng tối đa ${jobsPerDay()} tin / ngày để bảng việc không bị tin rác — mai bạn đăng tiếp nhé.`
    : null;
}
