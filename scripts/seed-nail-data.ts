/**
 * Seed dữ liệu ảo cho nền tảng PawNail Jobs (US/AU).
 * Chạy: npx tsx scripts/seed-nail-data.ts
 *
 * Tạo:
 *  - 20 Chủ tiệm (OWNER) kèm 1 tin tuyển dụng mỗi người (10 US: Cali/Texas, 10 AU: Sydney/Melbourne)
 *  - 20 Thợ nail (TECHNICIAN) kèm hồ sơ tay nghề + ảnh portfolio thật từ Unsplash
 */

import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import { Role, Market } from "@prisma/client";

const DEMO_PASSWORD = "Demo@12345";

// Ảnh nail art chất lượng cao, lấy trực tiếp từ Unsplash (miễn phí bản quyền thương mại)
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
];

function nailPhoto(seedIndex: number, w = 800): string {
  const url = NAIL_PHOTOS[seedIndex % NAIL_PHOTOS.length];
  return `${url}?w=${w}&auto=format&fit=crop&q=80`;
}

function avatar(name: string): string {
  // DiceBear fun-emoji — cùng nguồn avatar mặc định với app/api/register/route.ts
  // để demo account trông giống hệt trải nghiệm người dùng thật.
  return `https://api.dicebear.com/9.x/fun-emoji/png?seed=${encodeURIComponent(name)}&size=128&backgroundColor=ec4899,f472b6,fb923c,a78bfa,34d399,60a5fa`;
}

const SALON_OWNERS_US: { name: string; salonName: string; state: string; city: string }[] = [
  { name: "Kim Nguyen", salonName: "Luxe Nails & Spa", state: "CA", city: "Los Angeles" },
  { name: "Lisa Tran", salonName: "Golden Nails Bar", state: "CA", city: "San Diego" },
  { name: "Amy Pham", salonName: "Perfect 10 Nails", state: "CA", city: "San Jose" },
  { name: "Vivian Le", salonName: "Diamond Nail Lounge", state: "CA", city: "Sacramento" },
  { name: "Tina Dang", salonName: "Elegant Nails Studio", state: "CA", city: "Irvine" },
  { name: "Jenny Bui", salonName: "Star Nails & Spa", state: "TX", city: "Houston" },
  { name: "Cathy Vu", salonName: "Happy Nails Lounge", state: "TX", city: "Dallas" },
  { name: "Michelle Do", salonName: "Rose Nails Bar", state: "TX", city: "Austin" },
  { name: "Sandy Hoang", salonName: "Sunny Nails & Spa", state: "TX", city: "San Antonio" },
  { name: "Christine Phan", salonName: "Crystal Nails Studio", state: "TX", city: "Fort Worth" },
];

const SALON_OWNERS_AU: { name: string; salonName: string; state: string; city: string }[] = [
  { name: "Anh Nguyen", salonName: "Sydney Nail Bar", state: "NSW", city: "Sydney CBD" },
  { name: "Trang Le", salonName: "Chic Nails Studio", state: "NSW", city: "Bondi" },
  { name: "Ha Tran", salonName: "Lotus Nails & Beauty", state: "NSW", city: "Parramatta" },
  { name: "My Pham", salonName: "Diamond Nails Chatswood", state: "NSW", city: "Chatswood" },
  { name: "Thu Vo", salonName: "Pretty Nails Lounge", state: "NSW", city: "Newtown" },
  { name: "Ngoc Dang", salonName: "Melbourne Nail Studio", state: "VIC", city: "Melbourne CBD" },
  { name: "Kelly Bui", salonName: "Bella Nails & Spa", state: "VIC", city: "St Kilda" },
  { name: "Vy Hoang", salonName: "Luxury Nail Lounge", state: "VIC", city: "Richmond" },
  { name: "Jessica Vu", salonName: "Angel Nails Studio", state: "VIC", city: "Box Hill" },
  { name: "Diana Phan", salonName: "Ocean Nails & Beauty", state: "VIC", city: "Footscray" },
];

const SKILL_POOL = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước", "Wax", "Mi/Lông mày"];
const BENEFIT_POOL = ["Có chỗ ở", "Bao lương", "Hỗ trợ đổi bang", "Hỗ trợ Visa 482/EB3", "Tip cao", "Xe đưa đón"];

const SALARY_TYPES_US = ["Bao lương tuần", "% Ăn chia"];
const SALARY_TYPES_AU = ["Theo giờ AUD", "Theo tuần AUD"];
const SALARY_AMOUNTS_US = ["$1,000-1,300/tuần", "$1,200-1,500/tuần", "$1,400-1,800/tuần", "60/40 ăn chia"];
const SALARY_AMOUNTS_AU = ["$26-29/giờ", "$28-32/giờ", "$1,200-1,400/tuần", "$1,300-1,600/tuần"];

const JOB_TITLES = [
  "Cần thợ Bột/Dip gấp",
  "Tuyển thợ Gel-X kinh nghiệm",
  "Cần thợ chân tay nước full-time",
  "Tuyển thợ Design giỏi",
  "Cần thợ biết Wax + Nail",
];

const TECHNICIANS_US: { name: string; state: string; city: string }[] = [
  { name: "Emily Nguyen", state: "CA", city: "Los Angeles" },
  { name: "Sophia Tran", state: "CA", city: "San Diego" },
  { name: "Olivia Pham", state: "CA", city: "San Jose" },
  { name: "Grace Le", state: "CA", city: "Sacramento" },
  { name: "Chloe Dang", state: "CA", city: "Irvine" },
  { name: "Mia Bui", state: "TX", city: "Houston" },
  { name: "Ava Vu", state: "TX", city: "Dallas" },
  { name: "Isabella Do", state: "TX", city: "Austin" },
  { name: "Hannah Hoang", state: "TX", city: "San Antonio" },
  { name: "Lily Phan", state: "TX", city: "Fort Worth" },
];

const TECHNICIANS_AU: { name: string; state: string; city: string }[] = [
  { name: "Linh Nguyen", state: "NSW", city: "Sydney CBD" },
  { name: "Mai Le", state: "NSW", city: "Bondi" },
  { name: "Thao Tran", state: "NSW", city: "Parramatta" },
  { name: "Yen Pham", state: "NSW", city: "Chatswood" },
  { name: "Truc Vo", state: "NSW", city: "Newtown" },
  { name: "Han Dang", state: "VIC", city: "Melbourne CBD" },
  { name: "Nhi Bui", state: "VIC", city: "St Kilda" },
  { name: "Kim Hoang", state: "VIC", city: "Richmond" },
  { name: "Quynh Vu", state: "VIC", city: "Box Hill" },
  { name: "Tam Phan", state: "VIC", city: "Footscray" },
];

const BIO_TEMPLATES = [
  "Thợ nail chuyên nghiệp, tay nghề chắc, làm việc nhanh gọn và cẩn thận.",
  "Chuyên Design & Gel-X, phong cách hiện đại, khách hàng luôn hài lòng.",
  "Kinh nghiệm làm việc tại nhiều tiệm lớn, thân thiện, chịu khó học hỏi kỹ thuật mới.",
  "Chuyên Bột/Dip, làm form đẹp, tỉ mỉ trong từng chi tiết.",
  "Thợ trẻ năng động, cập nhật xu hướng nail mới liên tục, giao tiếp tốt với khách.",
];

async function main() {
  console.log("🌱 Bắt đầu seed dữ liệu Nail US/AU...");
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  let ownerCount = 0;
  let jobCount = 0;

  // ===== CHỦ TIỆM (OWNER) + TIN TUYỂN DỤNG =====
  const allOwners = [
    ...SALON_OWNERS_US.map((o) => ({ ...o, market: Market.US })),
    ...SALON_OWNERS_AU.map((o) => ({ ...o, market: Market.AU })),
  ];

  for (let i = 0; i < allOwners.length; i++) {
    const o = allOwners[i];
    const email = `owner${i + 1}.${o.market.toLowerCase()}@pawnailjobs.demo`;
    const phone = o.market === "US" ? `(555) 000-${1000 + i}` : `04${10000000 + i}`;

    const existing = await prisma.user.findUnique({ where: { email } });
    const user = existing || await prisma.user.create({
      data: {
        name: o.name,
        email,
        password: hashedPassword,
        role: Role.OWNER,
        market: o.market,
        state: o.state,
        city: o.city,
        phone,
        avatarUrl: avatar(o.name),
      },
    });
    ownerCount++;

    const salaryTypes = o.market === "US" ? SALARY_TYPES_US : SALARY_TYPES_AU;
    const salaryAmounts = o.market === "US" ? SALARY_AMOUNTS_US : SALARY_AMOUNTS_AU;

    await prisma.job.create({
      data: {
        title: JOB_TITLES[i % JOB_TITLES.length],
        salonName: o.salonName,
        description: `${o.salonName} tại ${o.city}, ${o.state} đang cần tuyển thợ nail có kinh nghiệm, môi trường làm việc thân thiện, khách sang, tip cao.`,
        ownerId: user.id,
        market: o.market,
        state: o.state,
        city: o.city,
        salaryType: salaryTypes[i % salaryTypes.length],
        salaryAmount: salaryAmounts[i % salaryAmounts.length],
        skills: [SKILL_POOL[i % SKILL_POOL.length], SKILL_POOL[(i + 2) % SKILL_POOL.length]].join(","),
        benefits: [BENEFIT_POOL[i % BENEFIT_POOL.length], BENEFIT_POOL[(i + 3) % BENEFIT_POOL.length]].join(","),
        phone,
        isUrgent: i % 3 !== 0,
      },
    });
    jobCount++;
    console.log(`  ✓ Owner: ${o.name} (${o.salonName}, ${o.city} ${o.market}) + 1 job`);
  }

  // ===== THỢ NAIL (TECHNICIAN) + PORTFOLIO =====
  const allTechs = [
    ...TECHNICIANS_US.map((t) => ({ ...t, market: Market.US })),
    ...TECHNICIANS_AU.map((t) => ({ ...t, market: Market.AU })),
  ];

  let techCount = 0;
  for (let i = 0; i < allTechs.length; i++) {
    const t = allTechs[i];
    const email = `tech${i + 1}.${t.market.toLowerCase()}@pawnailjobs.demo`;
    const phone = t.market === "US" ? `(555) 100-${2000 + i}` : `04${20000000 + i}`;

    const existing = await prisma.user.findUnique({ where: { email } });
    const user = existing || await prisma.user.create({
      data: {
        name: t.name,
        email,
        password: hashedPassword,
        role: Role.TECHNICIAN,
        market: t.market,
        state: t.state,
        city: t.city,
        phone,
        avatarUrl: avatar(t.name),
      },
    });

    const portfolioImages = [
      nailPhoto(i),
      nailPhoto(i + 5),
      nailPhoto(i + 10),
    ];

    await prisma.technicianProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        bio: BIO_TEMPLATES[i % BIO_TEMPLATES.length],
        yearsOfExperience: 1 + (i % 8),
        specialties: [SKILL_POOL[i % SKILL_POOL.length], SKILL_POOL[(i + 1) % SKILL_POOL.length]].join(","),
        status: i % 4 === 0 ? "URGENT" : "AVAILABLE",
        market: t.market,
        state: t.state,
        city: t.city,
        portfolioImages: JSON.stringify(portfolioImages),
      },
    });
    techCount++;
    console.log(`  ✓ Technician: ${t.name} (${t.city} ${t.market}) + 3 portfolio photos`);
  }

  console.log("\n🎉 Seed hoàn tất!");
  console.log(`   ${ownerCount} chủ tiệm, ${jobCount} tin tuyển dụng, ${techCount} thợ nail.`);
  console.log(`   Mật khẩu demo cho mọi tài khoản: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("❌ Seed thất bại:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
