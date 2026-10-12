// Đăng ký xong → tài khoản chính thức (PawNail Jobs, admin dùng để chăm sóc) TỰ mở cuộc trò chuyện
// với người mới: 1 tin "📋 Thông tin đăng ký" (đủ thông tin + từng câu trả lời khảo sát — người dùng
// cũng thấy, minh bạch) và 1 tin chào mừng "cần hỗ trợ gì cứ nhắn". Admin mở Tin nhắn là thấy ngay,
// khỏi lục trang Lead Radar. Lỗi ở đây KHÔNG được làm hỏng việc đăng ký (gọi trong after()).
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { SURVEY } from "@/lib/ownerSurvey";
import { stateName } from "@/lib/stateNames";
import { getOfficialAccount } from "@/lib/official";

export interface WelcomeInfo {
  userId: string;
  name: string;
  role: "TECHNICIAN" | "OWNER";
  email?: string | null;
  phone?: string | null;
  market: "US" | "AU";
  state?: string | null;
  city?: string | null;
  via?: string; // "email" | "google" | "facebook" | "phone" | "social"
  // Chủ tiệm
  salonName?: string | null;
  urgentRole?: string[];
  salaryType?: string | null;
  salaryAmount?: string | null;
  hasHousing?: boolean;
  surveyAnswers?: { key: string; answer: "A" | "B" }[];
  // Thợ
  specialties?: string[];
  desiredSalaryType?: string | null;
  desiredSalaryAmount?: string | null;
  desiredBenefits?: string[];
  status?: string | null;
  portfolioCount?: number;
}

const STATUS_VI: Record<string, string> = { AVAILABLE: "Đang rảnh, nhận việc", URGENT: "Cần việc gấp", BETTER: "Đang làm, tìm chỗ tốt hơn" };
const list = (x?: string[]) => (x && x.length ? x.join(", ") : null);

/** Nội dung tin "📋 Thông tin đăng ký" — chỉ ghi dòng nào có dữ liệu. */
export function registrationSummary(i: WelcomeInfo): string {
  const place = [i.city, i.state ? stateName(i.market, i.state) : null].filter(Boolean).join(", ");
  const rows: [string, string | null | undefined][] = [
    ["Vai trò", i.role === "OWNER" ? "Chủ tiệm" : "Thợ nail"],
    ["Họ tên", i.name],
    ...(i.role === "OWNER" ? ([["Tên tiệm", i.salonName]] as [string, string | null | undefined][]) : []),
    ["Số điện thoại", i.phone],
    ["Email", i.email && !/\.invalid$/i.test(i.email) ? i.email : null],
    ["Khu vực", `${place || "chưa ghi"} (${i.market === "AU" ? "Úc" : "Mỹ"})`],
    ["Đăng ký bằng", i.via === "google" ? "Google" : i.via === "facebook" ? "Facebook" : i.via === "phone" ? "Số điện thoại" : i.via === "social" ? "Google / Facebook / SĐT" : "Email"],
  ];
  if (i.role === "OWNER") {
    rows.push(["Cần tuyển", list(i.urgentRole)], ["Lương", [i.salaryAmount, i.salaryType].filter(Boolean).join(" · ") || null], ["Chỗ ở cho thợ", i.hasHousing === undefined ? null : i.hasHousing ? "Có" : "Không"]);
  } else {
    rows.push(
      ["Kỹ năng", list(i.specialties)],
      ["Mong muốn lương", [i.desiredSalaryAmount, i.desiredSalaryType].filter(Boolean).join(" · ") || null],
      ["Quyền lợi mong muốn", list(i.desiredBenefits)],
      ["Tình trạng", i.status ? STATUS_VI[i.status] ?? i.status : null],
      ["Ảnh tay nghề", i.portfolioCount ? `${i.portfolioCount} ảnh` : null],
    );
  }
  const lines = ["📋 Thông tin đăng ký", "", ...rows.filter(([, v]) => v).map(([k, v]) => `• ${k}: ${v}`)];
  const answers = i.surveyAnswers ?? [];
  // Chỉ đếm câu khớp bộ câu hỏi hiện tại (khoá lạ / câu đã bỏ không tính).
  const answered = SURVEY.map((q, n) => ({ q, n, a: answers.find((x) => x.key === q.key) })).filter((x) => x.a);
  if (answered.length) {
    lines.push("", `📝 Khảo sát (${answered.length}/${SURVEY.length} câu)`);
    for (const { q, n, a } of answered) lines.push(`${n + 1}. ${q.question}`, `   → ${a!.answer === "A" ? q.optionA : q.optionB}`);
  }
  return lines.join("\n").slice(0, 4900);
}

export function welcomeText(i: Pick<WelcomeInfo, "name" | "role">): string {
  // Gọi đủ họ tên: tên Việt (Trần Thị Lan) và kiểu Tây (Lan Tran) thứ tự ngược nhau — đoán "tên" dễ sai.
  const first = i.name.trim();
  return i.role === "OWNER"
    ? `Chào mừng ${first} đến với PawNail Jobs 🎉\n\nTin tuyển thợ của tiệm đã lên bảng việc, thợ gần tiệm sẽ thấy ngay. Anh/chị cần hỗ trợ gì — đăng tin, tìm thợ, hay góp ý — cứ nhắn ở đây, đội ngũ PawNail trả lời trong 24 giờ nhé!`
    : `Chào mừng ${first} đến với PawNail Jobs 🎉\n\nBạn đã có hồ sơ để tiệm tìm tới. Mẹo: đăng 3–5 ảnh tay nghề để được nhắn nhiều hơn. Bạn cần hỗ trợ gì — tìm việc, sửa hồ sơ, hay báo tin lạ — cứ nhắn ở đây, đội ngũ PawNail trả lời trong 24 giờ nhé!`;
}

/** Mở (hoặc dùng lại) cuộc trò chuyện chính thức ↔ người mới và gửi 2 tin. Trả về conversationId. */
export async function openWelcomeChat(i: WelcomeInfo): Promise<string | null> {
  if (process.env.WELCOME_CHAT === "0") return null;
  // Bộ nhớ tạm "chưa có admin" (30 giây) có thể cũ → hỏi thẳng DB 1 lần cho chắc.
  const official =
    (await getOfficialAccount()) ??
    (await prisma.user.findFirst({ where: process.env.OFFICIAL_ACCOUNT_ID ? { id: process.env.OFFICIAL_ACCOUNT_ID, role: "ADMIN" } : { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, avatarUrl: true } }));
  const officialId = official?.id;
  if (!officialId || officialId === i.userId) return null;
  const existing = await prisma.conversation.findFirst({
    where: { isGroup: false, AND: [{ participants: { some: { id: officialId } } }, { participants: { some: { id: i.userId } } }] },
    select: { id: true, _count: { select: { messages: true } } },
  });
  // Đã có tin chào trước đó (VD đăng ký lại / gọi trùng) → không gửi lặp.
  if (existing && existing._count.messages > 0) return existing.id;
  const convId = existing?.id ?? (await prisma.conversation.create({ data: { participants: { connect: [{ id: officialId }, { id: i.userId }] } }, select: { id: true } })).id;

  const now = Date.now();
  const msgs = [
    { id: "c" + crypto.randomBytes(12).toString("hex"), body: registrationSummary(i), createdAt: new Date(now) },
    { id: "c" + crypto.randomBytes(12).toString("hex"), body: welcomeText(i), createdAt: new Date(now + 1000) },
  ];
  for (const m of msgs) {
    await prisma.message.create({ data: { id: m.id, body: m.body, type: "TEXT", senderId: officialId, conversationId: convId, createdAt: m.createdAt } });
  }

  // Realtime: hộp thư admin (và người mới nếu đang mở app) hiện cuộc trò chuyện ngay.
  const pusher = getPusherServer();
  if (pusher) {
    for (const m of msgs) {
      await pusher
        .trigger([chatChannelName(officialId), chatChannelName(i.userId)], "new-message", {
          message: { id: m.id, content: m.body.slice(0, 3000), senderId: officialId, receiverId: i.userId, conversationId: convId, createdAt: m.createdAt, type: "TEXT", sender: { id: officialId, name: official?.name || "PawNail Jobs" } },
        })
        .catch(() => {});
    }
  }
  return convId;
}
