// Dữ liệu persona cho QA thủ công / chụp màn hình (chạy SAU scripts/seed-nail-data.ts trên DB QA LOCAL):
//   - khách Mỹ "Jessica Miller" (Dallas, TX) + khách Úc "Olivia Brown" (Sydney, NSW)
//   - menu của thợ Ava Vu: 2 mẫu thợ tự gõ tiếng Việt + 1 mẫu chép từ kho PawNail (có tên tiếng Anh)
//   - cuộc trò chuyện Jessica ↔ Ava: tin tiếng Việt của thợ (khách chỉ đọc tiếng Anh)
//   - 1 yêu cầu đặt lịch của Jessica (đã gắn vào tài khoản khách)
// TỪ CHỐI chạy khi DB không phải file cục bộ.
//   TURSO_DATABASE_URL="file:$QA_DB" npx tsx scripts/qa/seed_persona.mts
import bcrypt from "bcryptjs";

const url = process.env.TURSO_DATABASE_URL || "";
if (!/^file:/.test(url)) {
  console.error("❌ seed_persona chỉ chạy với TURSO_DATABASE_URL=file:<db QA cục bộ>.");
  process.exit(2);
}
const { default: prisma } = await import("../../lib/prisma");
const { linkBookingToClient } = await import("../../lib/bookingClients");

const pass = await bcrypt.hash("Demo@12345", 10);
async function client(email: string, name: string, market: "US" | "AU", state: string, city: string) {
  return (await prisma.user.findUnique({ where: { email } })) ?? prisma.user.create({ data: { email, name, password: pass, role: "CLIENT", market, state, city } });
}
const jessica = await client("jessica.client@pawnailjobs.demo", "Jessica Miller", "US", "TX", "Dallas");
await client("olivia.client@pawnailjobs.demo", "Olivia Brown", "AU", "NSW", "Sydney");

const ava = await prisma.user.findFirst({ where: { name: "Ava Vu", role: "TECHNICIAN" } });
if (!ava) throw new Error("Chưa có thợ Ava Vu — chạy scripts/seed-nail-data.ts trước.");
await prisma.technicianProfile.update({ where: { userId: ava.id }, data: { bio: "Thợ nail chuyên nghiệp, tay nghề chắc, làm việc nhanh gọn và cẩn thận.", yearsOfExperience: 1 } });

// Mẫu PawNail (kho mẫu) có bản tiếng Anh — menu chép từ mẫu này phải hiện tên tiếng Anh cho khách.
const design =
  (await prisma.nailDesign.findFirst({ where: { title: "Đồi mồi caramel viền vàng" } })) ??
  (await prisma.nailDesign.create({
    data: {
      day: new Date().toISOString().slice(0, 10), market: "US", occasion: "fall", title: "Đồi mồi caramel viền vàng", titleEn: "Caramel tortoiseshell with gold",
      description: "Nền đồi mồi caramel, viền vàng mảnh.", descriptionEn: "Caramel tortoiseshell base with a fine gold line.", skills: "Gel-X,Design", difficulty: 2, minutes: 70, priceHint: "$55–70",
      materials: JSON.stringify([{ vi: "Gel màu caramel", en: "Caramel color gel", qty: "1 lọ" }]), steps: "[]", provider: "sample", prompt: "qa", status: "published", publishedAt: new Date(),
    },
  }));
// /api/designs chỉ trả mẫu CÓ ảnh → gắn ảnh tay mẫu của repo (public/hands) + vài mẫu theo thị trường / mùa để
// kiểm tra bộ lọc thị trường (Lễ Tạ Ơn chỉ ở Mỹ, mùa xuân của Úc trong tháng 11) trên /designs.
if (!design.imageUrl) await prisma.nailDesign.update({ where: { id: design.id }, data: { imageUrl: "/hands/ombre.jpg" } });
const extra = [
  { market: "US", occasion: "thanksgiving", title: "Cam cháy Lễ Tạ Ơn", titleEn: "Thanksgiving burnt orange", img: "/hands/olive.jpg" },
  { market: "AU", occasion: "spring", title: "Pastel mùa xuân", titleEn: "Soft spring pastels", img: "/hands/pink.jpg" },
  { market: "US", occasion: null, title: "Nude bóng gương", titleEn: "Glossy mirror nude", img: "/hands/white.jpg" },
] as const;
for (const x of extra) {
  if (await prisma.nailDesign.findFirst({ where: { title: x.title } })) continue;
  await prisma.nailDesign.create({
    data: {
      day: new Date().toISOString().slice(0, 10), market: x.market, occasion: x.occasion, title: x.title, titleEn: x.titleEn,
      description: "Mẫu QA.", descriptionEn: "QA design.", skills: "Gel-X", difficulty: 1, minutes: 50, priceHint: "$45–60",
      materials: "[]", steps: "[]", imageUrl: x.img, provider: "sample", prompt: "qa", status: "published", publishedAt: new Date(),
    },
  });
}
if (!(await prisma.menuItem.count({ where: { ownerId: ava.id } }))) {
  await prisma.menuItem.createMany({
    data: [
      { ownerId: ava.id, category: "HAND", name: "Sơn gel tay + vẽ hoa", description: "Sơn gel, vẽ hoa nhí 2 ngón.", technique: "Gel", priceFrom: 45, priceTo: 55, minutes: 60, sortOrder: 0 },
      { ownerId: ava.id, category: "HAND", name: "Bột nhúng SNS màu nude", technique: "Dip/SNS", priceFrom: 40, minutes: 45, sortOrder: 1 },
      { ownerId: ava.id, category: "HAND", name: design.title, description: design.description, technique: "Gel-X", priceFrom: 55, priceTo: 70, minutes: 70, sourceDesignId: design.id, sortOrder: 2 },
      { ownerId: ava.id, category: "FOOT", name: "Spa pedicure", priceFrom: 35, minutes: 70, sortOrder: 3 },
    ],
  });
}

// Cuộc trò chuyện khách ↔ thợ
let conv = await prisma.conversation.findFirst({ where: { isGroup: false, AND: [{ participants: { some: { id: jessica.id } } }, { participants: { some: { id: ava.id } } }] } });
if (!conv) {
  conv = await prisma.conversation.create({ data: { participants: { connect: [{ id: jessica.id }, { id: ava.id }] } } });
  const t0 = Date.now() - 20 * 60_000;
  await prisma.message.create({ data: { conversationId: conv.id, senderId: jessica.id, body: "Hi! Do you have time on Saturday afternoon?", createdAt: new Date(t0) } });
  await prisma.message.create({ data: { conversationId: conv.id, senderId: ava.id, body: "Dạ chị ơi thứ 7 em còn trống lúc 2 giờ chiều nha, chị ghé được không ạ?", createdAt: new Date(t0 + 6 * 60_000) } });
}

// Yêu cầu đặt lịch của khách (đã đăng nhập) → nằm trong "Lịch hẹn của tôi"
const has = await prisma.bookingRequest.findFirst({ where: { techId: ava.id, clientName: "Jessica Miller" } });
if (!has) {
  const sat = new Date();
  sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
  const b = await prisma.bookingRequest.create({
    data: { techId: ava.id, itemName: "Caramel tortoiseshell with gold", itemPrice: "$55–70", clientName: "Jessica Miller", clientPhone: "+12145550142", preferredDate: sat.toISOString().slice(0, 10), preferredTime: "afternoon", locale: "en" },
  });
  await linkBookingToClient(b.id, jessica.id);
}
console.log(`persona: client ${jessica.email} · tech Ava Vu ${ava.id} · conversation ${conv.id}`);
await prisma.$disconnect();
