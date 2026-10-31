// Đăng ký xong → tài khoản chính thức (PawNail, admin dùng để chăm sóc) TỰ mở cuộc trò chuyện với
// người mới: 1 tin "Thông tin đăng ký" (đủ thông tin + từng câu trả lời khảo sát — người dùng cũng thấy,
// minh bạch) và 1 tin chào mừng. Cả 2 tin viết theo ngôn ngữ của form đăng ký (mặc định tiếng Anh):
// khách Mỹ/Úc không mở Tin nhắn ra thấy 2 tin tiếng Việt. Không hứa thời gian trả lời (chưa đo).
// Lỗi ở đây KHÔNG được làm hỏng việc đăng ký (gọi trong after()).
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { SURVEY } from "@/lib/ownerSurvey";
import { stateName } from "@/lib/stateNames";
import { getOfficialAccount } from "@/lib/official";
import { dtEn } from "@/lib/i18n/dtEn";
import { getUserLocale } from "@/lib/userLocale";
import type { Locale } from "@/lib/i18n/config";

export interface WelcomeInfo {
  userId: string;
  name: string;
  role: "TECHNICIAN" | "OWNER" | "CLIENT";
  /** Ngôn ngữ của người mới (form đăng ký). Không có → tiếng Anh. */
  locale?: Locale;
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

const STATUS: Record<string, [vi: string, en: string]> = {
  AVAILABLE: ["Sẵn sàng nhận việc", "Available"],
  URGENT: ["Sẵn sàng nhận việc ngay", "Available now"],
  BETTER: ["Đang làm, sẵn sàng cân nhắc nơi mới", "Open to better offers"],
};
const list = (x?: string[], en = false) => (x && x.length ? x.map((v) => (en ? dtEn(v) : v)).join(", ") : null);

/** Nội dung tin "Thông tin đăng ký" — chỉ ghi dòng nào có dữ liệu. */
export function registrationSummary(i: WelcomeInfo): string {
  const en = i.locale !== "vi";
  const L = (vi: string, e: string) => (en ? e : vi);
  const v = (x: string | null | undefined) => (x && en ? dtEn(x) : x);
  const place = [i.city, i.state ? stateName(i.market, i.state) : null].filter(Boolean).join(", ");
  const rows: [string, string | null | undefined][] = [
    [L("Vai trò", "Role"), i.role === "OWNER" ? L("Chủ tiệm", "Salon owner") : i.role === "CLIENT" ? L("Khách làm nail", "Nail client") : L("Thợ nail", "Nail technician")],
    [L("Họ tên", "Name"), i.name],
    ...(i.role === "OWNER" ? ([[L("Tên tiệm", "Salon"), i.salonName]] as [string, string | null | undefined][]) : []),
    [L("Số điện thoại", "Phone"), i.phone],
    ["Email", i.email && !/\.invalid$/i.test(i.email) ? i.email : null],
    [L("Khu vực", "Area"), `${place || L("chưa ghi", "not set")} (${i.market === "AU" ? L("Úc", "Australia") : L("Mỹ", "US")})`],
    [L("Đăng ký bằng", "Signed up with"), i.via === "google" ? "Google" : i.via === "facebook" ? "Facebook" : i.via === "phone" ? L("Số điện thoại", "Phone number") : i.via === "social" ? L("Google / Facebook / SĐT", "Google / Facebook / phone") : "Email"],
  ];
  if (i.role === "CLIENT") {
    // khách: không có kỹ năng / lương — chỉ thông tin liên hệ + khu vực
  } else if (i.role === "OWNER") {
    rows.push(
      [L("Cần tuyển", "Hiring for"), list(i.urgentRole, en)],
      [L("Lương", "Pay"), [v(i.salaryAmount), v(i.salaryType)].filter(Boolean).join(" · ") || null],
      [L("Chỗ ở cho thợ", "Housing for techs"), i.hasHousing === undefined ? null : i.hasHousing ? L("Có", "Yes") : L("Không", "No")],
    );
  } else {
    rows.push(
      [L("Kỹ năng", "Skills"), list(i.specialties, en)],
      [L("Mong muốn lương", "Desired pay"), [v(i.desiredSalaryAmount), v(i.desiredSalaryType)].filter(Boolean).join(" · ") || null],
      [L("Quyền lợi mong muốn", "Desired benefits"), list(i.desiredBenefits, en)],
      [L("Tình trạng", "Status"), i.status ? (STATUS[i.status]?.[en ? 1 : 0] ?? i.status) : null],
      [L("Ảnh tay nghề", "Work photos"), i.portfolioCount ? L(`${i.portfolioCount} ảnh`, `${i.portfolioCount} photo${i.portfolioCount === 1 ? "" : "s"}`) : null],
    );
  }
  const lines = [L("Thông tin đăng ký", "Your sign-up details"), "", ...rows.filter(([, x]) => x).map(([k, x]) => `• ${k}: ${x}`)];
  const answers = i.surveyAnswers ?? [];
  // Chỉ đếm câu khớp bộ câu hỏi hiện tại (khoá lạ / câu đã bỏ không tính).
  const answered = SURVEY.map((q, n) => ({ q, n, a: answers.find((x) => x.key === q.key) })).filter((x) => x.a);
  if (answered.length) {
    lines.push("", L(`Khảo sát (${answered.length}/${SURVEY.length} câu)`, `Survey (${answered.length} of ${SURVEY.length} questions)`));
    for (const { q, n, a } of answered) {
      const opt = a!.answer === "A" ? q.optionA : q.optionB;
      lines.push(`${n + 1}. ${en ? dtEn(q.question) : q.question}`, `   → ${en ? dtEn(opt) : opt}`);
    }
  }
  return lines.join("\n").slice(0, 4900);
}

export function welcomeText(i: Pick<WelcomeInfo, "name" | "role" | "locale">, existing = false): string {
  const en = i.locale !== "vi";
  // Gọi đủ họ tên: tên Việt (Trần Thị Lan) và kiểu Tây (Lan Tran) thứ tự ngược nhau — đoán "tên" dễ sai.
  const name = i.name.trim();
  // Người đăng ký TRƯỚC khi có tin chào tự động → cảm ơn thay vì "chào mừng" (họ đã ở đây vài hôm).
  if (existing) {
    return en
      ? `Thanks for being on PawNail, ${name}.\n\nThis is your direct line to the PawNail team. Need help with ${i.role === "OWNER" ? "a job post or hiring" : "your profile or a job"}, or want to suggest something? Reply here and the PawNail team will get back to you.`
      : `Cảm ơn ${name} đã tham gia PawNail.\n\nĐây là kênh hỗ trợ riêng của bạn với đội ngũ PawNail. Cần hỗ trợ về ${i.role === "OWNER" ? "tin tuyển hay tuyển thợ" : "hồ sơ hay việc làm"}, hoặc muốn góp ý? Hãy nhắn tại đây, đội ngũ PawNail sẽ phản hồi.`;
  }
  if (i.role === "CLIENT") {
    return en
      ? `Welcome to PawNail, ${name}.\n\nHere you can try on nail looks, discover salons with real photos and prices, and send booking requests without calling.\n\nTry-On: take one photo of your hand to see 10 suggested looks on your own nails, then send your favorite to a salon in chat.\n\nQuestions? Reply here and the PawNail team will get back to you.`
      : `Chào mừng ${name} đến với PawNail.\n\nTại đây bạn có thể thử mẫu nail, tìm tiệm có ảnh thật và bảng giá, và gửi yêu cầu đặt lịch mà không cần gọi điện.\n\nThử mẫu: chụp một ảnh bàn tay để xem 10 mẫu gợi ý trên chính móng của bạn, rồi gửi mẫu ưng ý cho tiệm trong tin nhắn.\n\nCần hỗ trợ? Hãy nhắn tại đây, đội ngũ PawNail sẽ phản hồi.`;
  }
  if (i.role === "OWNER") {
    return en
      ? `Welcome to PawNail, ${name}.\n\nYour job post is live on the job board. Tip: add your service menu with prices so clients can request bookings, and PawNail Assistant can suggest replies that match your prices.\n\nNeed help hiring? Reply here and the PawNail team will get back to you.`
      : `Chào mừng ${name} đến với PawNail.\n\nTin tuyển của tiệm đã lên bảng việc làm. Gợi ý: thêm menu dịch vụ có giá để khách gửi yêu cầu đặt lịch; Trợ lý PawNail sẽ gợi ý câu trả lời đúng giá menu.\n\nCần hỗ trợ tuyển thợ? Hãy nhắn tại đây, đội ngũ PawNail sẽ phản hồi.`;
  }
  return en
    ? `Welcome to PawNail, ${name}.\n\nYour profile is live, so salons can find you. Two tips: add 3–5 photos of your work, and set up your menu with prices so clients can request bookings.\n\nNeed help with your profile or a job? Reply here and the PawNail team will get back to you.`
    : `Chào mừng ${name} đến với PawNail.\n\nHồ sơ của bạn đã hiển thị để tiệm tìm đến. Gợi ý: thêm 3–5 ảnh tay nghề và tạo menu dịch vụ có giá để khách gửi yêu cầu đặt lịch.\n\nCần hỗ trợ về hồ sơ hay việc làm? Hãy nhắn tại đây, đội ngũ PawNail sẽ phản hồi.`;
}

/** Mở (hoặc dùng lại) cuộc trò chuyện chính thức ↔ người mới và gửi 2 tin. Trả về conversationId. */
export async function openWelcomeChat(i: WelcomeInfo, opts: { existing?: boolean } = {}): Promise<string | null> {
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
    { id: "c" + crypto.randomBytes(12).toString("hex"), body: welcomeText(i, opts.existing), createdAt: new Date(now + 1000) },
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
          message: { id: m.id, content: m.body.slice(0, 3000), senderId: officialId, receiverId: i.userId, conversationId: convId, createdAt: m.createdAt, type: "TEXT", sender: { id: officialId, name: official?.name || "PawNail" } },
        })
        .catch(() => {});
    }
  }
  return convId;
}

/** Dựng thông tin đăng ký từ DB (cho người đăng ký trước khi có tin chào tự động). */
export async function welcomeInfoFromDb(userId: string): Promise<WelcomeInfo | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, role: true, market: true, state: true, city: true, password: true, surveyAnswers: true,
      technicianProfile: { select: { specialties: true, desiredSalaryType: true, desiredSalaryAmount: true, desiredBenefits: true, status: true, portfolioImages: true } },
    },
  });
  if (!u || (u.role !== "OWNER" && u.role !== "TECHNICIAN")) return null;
  const csv = (x?: string | null) => (x || "").split(",").map((s) => s.trim()).filter(Boolean);
  const via = u.email.endsWith("@phone.invalid") ? "phone" : u.password?.startsWith("oauth:") ? "social" : "email";
  const base = { userId: u.id, name: u.name, role: u.role, locale: await getUserLocale(u.id), email: u.email, phone: u.phone, market: u.market as "US" | "AU", state: u.state, city: u.city, via } as WelcomeInfo;
  if (u.role === "OWNER") {
    const job = await prisma.job.findFirst({ where: { ownerId: u.id }, orderBy: { createdAt: "asc" }, select: { salonName: true, skills: true, salaryType: true, salaryAmount: true, benefits: true } });
    let answers: { key: string; answer: "A" | "B" }[] = [];
    try { answers = JSON.parse(u.surveyAnswers || "[]"); } catch {}
    return { ...base, salonName: job?.salonName, urgentRole: csv(job?.skills), salaryType: job?.salaryType, salaryAmount: job?.salaryAmount, hasHousing: job ? csv(job.benefits).some((b) => /chỗ ở/i.test(b)) : undefined, surveyAnswers: answers };
  }
  const t = u.technicianProfile;
  let photos = 0;
  try { photos = JSON.parse(t?.portfolioImages || "[]").length; } catch {}
  return { ...base, specialties: csv(t?.specialties), desiredSalaryType: t?.desiredSalaryType, desiredSalaryAmount: t?.desiredSalaryAmount, desiredBenefits: csv(t?.desiredBenefits), status: t?.status, portfolioCount: photos };
}

/** Bù tin chào cho MỌI người dùng thật chưa có cuộc trò chuyện với tài khoản chính thức. */
export async function backfillWelcomeChats(limit = 500): Promise<{ opened: number; skipped: number }> {
  const official = await getOfficialAccount();
  if (!official) return { opened: 0, skipped: 0 };
  const users = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "TECHNICIAN"] }, id: { not: official.id }, NOT: [{ email: { endsWith: "@feed.pawnail.invalid" } }, { email: { endsWith: "pawnailjobs.demo" } }, { email: { endsWith: "@qa.test" } }] }, // bỏ tài khoản hệ thống "đăng hộ tiệm" + MỌI tài khoản demo (…@pawnailjobs.demo VÀ …@feed.pawnailjobs.demo — 16/10 lọt các tiệm mồi) + test; người đăng ký bằng SĐT (@phone.invalid) vẫn tính
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: limit,
  });
  let opened = 0, skipped = 0;
  for (const { id } of users) {
    const info = await welcomeInfoFromDb(id);
    if (!info) { skipped++; continue; }
    const before = await prisma.conversation.count({ where: { isGroup: false, AND: [{ participants: { some: { id: official.id } } }, { participants: { some: { id } } }], messages: { some: {} } } });
    if (before) { skipped++; continue; }
    if (await openWelcomeChat(info, { existing: true })) opened++; else skipped++;
  }
  return { opened, skipped };
}
