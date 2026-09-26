/**
 * Bơm thêm nội dung cho các bang đang trống/ít (Cần Thợ Gấp + Thợ Đang Rảnh
 * + Bảng Tin) — seed-nail-data.ts trước đây chỉ phủ 4 bang (CA/TX/NSW/VIC),
 * khiến 12 bang còn lại trong bộ lọc trống trơn hoặc chỉ có 1 tin.
 *
 * Dùng email đuôi "-fill{N}" để không đụng vào roster owner{N}/tech{N} đã
 * có sẵn. Chạy: npx tsx scripts/seed-fill-states.ts
 */

import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import { Role, Market, PostType } from "@prisma/client";

const DEMO_PASSWORD = "Demo@12345";

const NAIL_PHOTOS = [
  "https://images.unsplash.com/photo-1604654894610-df63bc536371",
  "https://images.unsplash.com/photo-1619607146034-5a05296c8f9a",
  "https://images.unsplash.com/photo-1519014816548-bf5fe059798b",
  "https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f",
  "https://images.unsplash.com/photo-1604654894611-6973b376cbde",
  "https://images.unsplash.com/photo-1754799670312-8e7da8e40ad7",
  "https://images.unsplash.com/photo-1587729927069-ef3b7a5ab9b4",
  "https://images.unsplash.com/photo-1720343409646-960f6dcccae3",
  "https://images.unsplash.com/photo-1688583417770-ff6cc18071dc",
  "https://images.unsplash.com/photo-1735236007245-9dc6e28bbe56",
  "https://images.unsplash.com/photo-1754799670410-b282791342c3",
  "https://images.unsplash.com/photo-1632345031435-8727f6897d53",
  "https://images.unsplash.com/photo-1588015810531-dd522c9c8bbb",
  "https://images.unsplash.com/photo-1696342003838-4a8f9f36588c",
  "https://images.unsplash.com/photo-1736434518489-0eb84070017f",
  "https://images.unsplash.com/photo-1607779097040-26e80aa78e66",
  "https://images.unsplash.com/photo-1588359953494-0c215e3cedc6",
  "https://images.unsplash.com/photo-1641814280326-d74ea2300067",
  "https://images.unsplash.com/photo-1687723977270-4f86dbda39e6",
];

function nailPhoto(i: number, w = 800) {
  return `${NAIL_PHOTOS[i % NAIL_PHOTOS.length]}?w=${w}&auto=format&fit=crop&q=80`;
}

function avatar(name: string) {
  // DiceBear fun-emoji — cùng nguồn avatar mặc định với app/api/register/route.ts.
  return `https://api.dicebear.com/9.x/fun-emoji/png?seed=${encodeURIComponent(name)}&size=128&backgroundColor=ec4899,f472b6,fb923c,a78bfa,34d399,60a5fa`;
}

// Cùng 20 câu FOMO ngành nail đã dùng ở scripts/seed-feed-and-supply.ts —
// giữ giọng văn nhất quán xuyên suốt Bảng Tin.
const CAPTIONS = [
  "Ngành nail 2026 đang bùng nổ thật sự — tiệm nào cũng tranh nhau tuyển thợ Gel-X, khách đặt lịch trước cả tuần mới có chỗ 🔥",
  "Xu hướng chrome mirror đang cháy hàng khắp các tiệm, thợ nào chưa biết làm kiểu này dễ bị khách bỏ qua lắm đó 💅",
  "Nghe nói mùa này thợ giỏi Ombre/Aura được các tiệm săn đón dữ lắm, lương bao tuần cũng tăng theo luôn 📈",
  "Khách hàng bây giờ tinh mắt lắm, tiệm nào không cập nhật trend mới là mất khách vào tay đối thủ ngay 😱",
  "3D charm đang là kiểu được tìm nhiều nhất tuần này — chậm chân là hết mẫu để làm cho khách à nha!",
  "Nghe đồn cuối năm nay ngành nail còn hot hơn nữa, tiệm nào chuẩn bị nhân sự sớm mới không bị động dịp Tết 🎉",
  "Milky white đang phủ sóng khắp mạng xã hội — không ngạc nhiên khi khách nào cũng đòi làm bằng được kiểu này 🤍",
  "Thợ tay nghề Dip/SNS bây giờ hiếm lắm, tiệm nào giữ được thợ giỏi là coi như nắm chắc phần thắng rồi.",
  "French tip biến tấu đang là cơn sốt mới, không update kịp là tự động tụt lại phía sau so với tiệm khác.",
  "Mùa cưới sắp tới, các tiệm đang chạy đua nhận bộ nail cô dâu — đặt lịch trễ chút là hết suất luôn đó 👰",
  "Cat-eye gel ánh kim đang là kiểu phải có trong tiệm nào muốn giữ chân khách VIP mùa này.",
  "Giá vật tư tăng nhưng khách vẫn xếp hàng dài — chứng tỏ ngành nail chưa bao giờ hạ nhiệt cả.",
  "Aura nails đang là kiểu hot nhất được các bạn trẻ săn lùng, tiệm nào có mẫu này là auto full lịch.",
  "Form vuông dài kiểu Hàn đang làm mưa làm gió, thợ nào chưa luyện tay theo kịp trend này là hơi trễ rồi.",
  "Nghe nói bên Úc/Mỹ tiệm nào có thợ đa năng (vừa bột vừa dip) đang được bao lương cao hơn hẳn năm ngoái.",
  "Top coat bóng gương không ố vàng đang cháy hàng ở khắp các tiệm sỉ — ai cũng tranh nhau đặt trước.",
  "Đợt này khách trẻ chuộng nail tối giản nhưng tinh tế, tiệm nào bắt trend nhanh là hút khách mới ầm ầm.",
  "Ngành nail đang thiếu thợ trầm trọng ở nhiều bang — đây là thời điểm vàng để thợ giỏi tự tin đàm phán lương 🔥",
  "Pastel ombre lên ngôi mùa này, không có mẫu design này trong tiệm coi như bỏ lỡ nguyên nhóm khách trẻ.",
  "Cuối tuần này tiệm nào cũng kín lịch — báo hiệu ngành nail đang bước vào giai đoạn tăng trưởng mạnh nhất năm 🎉",
];

const FIRST_NAMES = ["Linh", "Mai", "Trang", "Hoa", "Thu", "Ngoc", "Anh", "Huyen", "Yen", "Chi", "Van", "Thao", "Quyen", "Nhi", "Tram", "Duyen", "Han", "Kieu", "My", "Loan", "Bao", "Tuan", "Khanh", "Minh", "Duc", "Long", "Nam", "Hieu", "Phong", "Dat"];
const LAST_NAMES = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Vu", "Vo", "Dang", "Bui", "Do", "Ngo", "Duong", "Ly", "Truong", "Phan"];

function personName(seed: number) {
  return `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[(seed * 3 + 1) % LAST_NAMES.length]}`;
}

const SALON_PREFIXES = ["Luxe", "Golden", "Diamond", "Star", "Happy", "Rose", "Sunny", "Crystal", "Elegant", "Perfect", "Angel", "Bella", "Lotus", "Chic", "Pretty", "Ocean", "Royal", "Pearl", "Charm", "Glow"];
const SALON_SUFFIXES = ["Nails & Spa", "Nail Bar", "Nail Lounge", "Nails Studio", "Beauty Nails", "Nail House"];

function salonName(seed: number) {
  return `${SALON_PREFIXES[seed % SALON_PREFIXES.length]} ${SALON_SUFFIXES[(seed * 2 + 1) % SALON_SUFFIXES.length]}`;
}

const SKILL_POOL = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước", "Wax", "Mi/Lông mày"];
const BENEFIT_POOL = ["Có chỗ ở", "Bao lương", "Hỗ trợ đổi bang", "Hỗ trợ Visa 482/EB3", "Tip cao", "Xe đưa đón"];
const JOB_TITLES = [
  "Cần thợ Bột/Dip gấp",
  "Tuyển thợ Gel-X kinh nghiệm",
  "Cần thợ chân tay nước full-time",
  "Tuyển thợ Design giỏi",
  "Cần thợ biết Wax + Nail",
  "Cần thợ đa năng gấp",
  "Tuyển thợ kinh nghiệm lâu năm",
  "Cần thợ mới ra trường, được đào tạo thêm",
  "Tuyển thợ chuyên Ombre/Aura",
  "Cần thợ làm ca tối/cuối tuần",
];
const BIO_TEMPLATES = [
  "Thợ nail chuyên nghiệp, tay nghề chắc, làm việc nhanh gọn và cẩn thận.",
  "Chuyên Design & Gel-X, phong cách hiện đại, khách hàng luôn hài lòng.",
  "Kinh nghiệm làm việc tại nhiều tiệm lớn, thân thiện, chịu khó học hỏi kỹ thuật mới.",
  "Chuyên Bột/Dip, làm form đẹp, tỉ mỉ trong từng chi tiết.",
  "Thợ trẻ năng động, cập nhật xu hướng nail mới liên tục, giao tiếp tốt với khách.",
];

const SALARY_TYPES_US = ["Bao lương tuần", "% Ăn chia"];
const SALARY_TYPES_AU = ["Theo giờ AUD", "Theo tuần AUD"];
const SALARY_AMOUNTS_US = ["$1,000-1,300/tuần", "$1,200-1,500/tuần", "$1,400-1,800/tuần", "60/40 ăn chia"];
const SALARY_AMOUNTS_AU = ["$26-29/giờ", "$28-32/giờ", "$1,200-1,400/tuần", "$1,300-1,600/tuần"];

// Bang đang trống/ít + số lượng chủ tiệm & thợ muốn thêm vào mỗi bang —
// ưu tiên nhiều hơn cho bang có tín hiệu cầu thợ thật cao (xem
// lib/nailRadarData.ts DEMAND_SIGNAL: GA/FL cao hơn NC/VA/IL/NY/WA).
const US_FILL: { state: string; city: string; owners: number; techs: number }[] = [
  { state: "FL", city: "Orlando", owners: 3, techs: 3 },
  { state: "FL", city: "Miami", owners: 2, techs: 2 },
  { state: "GA", city: "Atlanta", owners: 3, techs: 3 },
  { state: "NY", city: "New York", owners: 2, techs: 2 },
  { state: "WA", city: "Seattle", owners: 2, techs: 2 },
  { state: "NC", city: "Charlotte", owners: 2, techs: 2 },
  { state: "VA", city: "Virginia Beach", owners: 2, techs: 2 },
  { state: "AZ", city: "Phoenix", owners: 2, techs: 2 },
  { state: "IL", city: "Chicago", owners: 2, techs: 2 },
];

const AU_FILL: { state: string; city: string; owners: number; techs: number }[] = [
  { state: "QLD", city: "Brisbane", owners: 3, techs: 3 },
  { state: "QLD", city: "Gold Coast", owners: 2, techs: 2 },
  { state: "WA", city: "Perth", owners: 2, techs: 2 },
  { state: "SA", city: "Adelaide", owners: 2, techs: 2 },
  { state: "ACT", city: "Canberra", owners: 2, techs: 2 },
];

async function createOwnerWithJobs(seed: number, market: Market, state: string, city: string, hashedPassword: string, jobsPerOwner: number) {
  const email = `owner-fill${seed}.${market.toLowerCase()}@pawnailjobs.demo`;
  const name = personName(seed);
  const salon = salonName(seed);
  const phone = market === "US" ? `(555) 400-${3000 + seed}` : `04${40000000 + seed}`;

  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing || await prisma.user.create({
    data: { name, email, password: hashedPassword, role: Role.OWNER, market, state, city, phone, avatarUrl: avatar(name) },
  });

  const salaryTypes = market === "US" ? SALARY_TYPES_US : SALARY_TYPES_AU;
  const salaryAmounts = market === "US" ? SALARY_AMOUNTS_US : SALARY_AMOUNTS_AU;

  let jobCount = 0;
  for (let j = 0; j < jobsPerOwner; j++) {
    const idx = seed * 3 + j;
    await prisma.job.create({
      data: {
        title: JOB_TITLES[idx % JOB_TITLES.length],
        salonName: salon,
        description: `${salon} tại ${city}, ${state} đang cần tuyển thợ nail có kinh nghiệm, môi trường làm việc thân thiện, khách sang, tip cao.`,
        ownerId: user.id,
        market, state, city,
        salaryType: salaryTypes[idx % salaryTypes.length],
        salaryAmount: salaryAmounts[idx % salaryAmounts.length],
        skills: [SKILL_POOL[idx % SKILL_POOL.length], SKILL_POOL[(idx + 2) % SKILL_POOL.length]].join(","),
        benefits: [BENEFIT_POOL[idx % BENEFIT_POOL.length], BENEFIT_POOL[(idx + 3) % BENEFIT_POOL.length]].join(","),
        phone,
        isUrgent: idx % 3 !== 0,
      },
    });
    jobCount++;
  }
  return { user, jobCount };
}

async function createTech(seed: number, market: Market, state: string, city: string, hashedPassword: string) {
  const email = `tech-fill${seed}.${market.toLowerCase()}@pawnailjobs.demo`;
  const name = personName(seed + 500);
  const phone = market === "US" ? `(555) 500-${4000 + seed}` : `04${50000000 + seed}`;

  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing || await prisma.user.create({
    data: { name, email, password: hashedPassword, role: Role.TECHNICIAN, market, state, city, phone, avatarUrl: avatar(name) },
  });

  const portfolioImages = [nailPhoto(seed), nailPhoto(seed + 7), nailPhoto(seed + 13)];
  await prisma.technicianProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      bio: BIO_TEMPLATES[seed % BIO_TEMPLATES.length],
      yearsOfExperience: 1 + (seed % 8),
      specialties: [SKILL_POOL[seed % SKILL_POOL.length], SKILL_POOL[(seed + 1) % SKILL_POOL.length]].join(","),
      status: seed % 4 === 0 ? "URGENT" : "AVAILABLE",
      market, state, city,
      portfolioImages: JSON.stringify(portfolioImages),
    },
  });
  return user;
}

async function main() {
  console.log("🌱 Bơm thêm nội dung cho các bang đang trống/ít...");
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  const allNewUsers: { id: string }[] = [];
  let ownerCount = 0, jobCount = 0, techCount = 0;
  let seed = 1;

  for (const group of [...US_FILL.map((g) => ({ ...g, market: Market.US })), ...AU_FILL.map((g) => ({ ...g, market: Market.AU }))]) {
    for (let i = 0; i < group.owners; i++) {
      const jobsPerOwner = 2 + (seed % 2); // 2-3 tin mỗi chủ, tạo cảm giác nhiều lựa chọn
      const { user, jobCount: jc } = await createOwnerWithJobs(seed, group.market, group.state, group.city, hashedPassword, jobsPerOwner);
      allNewUsers.push(user);
      ownerCount++;
      jobCount += jc;
      seed++;
    }
    for (let i = 0; i < group.techs; i++) {
      const user = await createTech(seed, group.market, group.state, group.city, hashedPassword);
      allNewUsers.push(user);
      techCount++;
      seed++;
    }
    console.log(`  ✓ ${group.state} (${group.city}, ${group.market}): +${group.owners} chủ, +${group.techs} thợ`);
  }

  // Mỗi user mới đăng 1 bài Bảng Tin FOMO ngành nail — tăng mật độ nội
  // dung khi lướt thay vì chỉ có 50 bài cũ.
  let postCount = 0;
  for (let i = 0; i < allNewUsers.length; i++) {
    const u = allNewUsers[i];
    await prisma.post.create({
      data: {
        authorId: u.id,
        content: CAPTIONS[i % CAPTIONS.length],
        postType: PostType.SHOWCASE,
        mediaUrls: JSON.stringify([nailPhoto(i + 20), nailPhoto(i + 27)]),
      },
    });
    postCount++;
  }

  console.log("\n🎉 Hoàn tất!");
  console.log(`   +${ownerCount} chủ tiệm, +${jobCount} tin tuyển dụng, +${techCount} thợ nail, +${postCount} bài đăng.`);
  console.log(`   Mật khẩu demo: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("❌ Seed thất bại:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
