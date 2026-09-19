/**
 * scripts/scrape-and-feed-nails.ts
 * Chạy: npx tsx scripts/scrape-and-feed-nails.ts
 *
 * PIPELINE: raw text (tin tuyển thợ) -> parser (regex) -> Job + User(OWNER) trong Turso.
 *
 * LƯU Ý QUAN TRỌNG VỀ PHẠM VI:
 * Script này KHÔNG tự động truy cập/cào trực tiếp Facebook Groups — việc bot
 * tự động đăng nhập và trích xuất nội dung từ Facebook vi phạm Điều khoản
 * Dịch vụ của Meta, và việc đăng lại số điện thoại/tên thật của người khác
 * lên nền tảng khác mà không có sự đồng ý của họ là vấn đề quyền riêng tư
 * (có thể bị xem là mạo danh nếu tạo tài khoản OWNER đứng tên họ). Vì vậy
 * `RAW_POSTS` bên dưới là dữ liệu MẪU hư cấu (viết theo đúng văn phong các
 * bài tuyển thợ thường thấy) chỉ để kiểm thử pipeline.
 *
 * Cách dùng với dữ liệu thật: dán nội dung mà bạn ĐÃ CÓ QUYỀN sử dụng
 * (ví dụ: chủ tiệm tự gửi form/tin nhắn cho bạn) vào mảng `RAW_POSTS`, hoặc
 * import mảng string từ nguồn khác rồi gọi `runPipeline(posts)`.
 */

import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import { Role, Market } from "@prisma/client";

// ============================================================
// 1. PARSER — bóc tách state/city/salary/skills/phone từ raw text
// ============================================================

const US_STATES = ["CA", "TX", "FL", "GA", "NY", "WA", "NC", "VA", "AZ", "IL", "NV", "OR"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT", "TAS", "NT"];

const CITY_HINTS: { name: string; state: string; market: "US" | "AU" }[] = [
  { name: "Garden Grove", state: "CA", market: "US" },
  { name: "Westminster", state: "CA", market: "US" },
  { name: "Los Angeles", state: "CA", market: "US" },
  { name: "San Diego", state: "CA", market: "US" },
  { name: "San Jose", state: "CA", market: "US" },
  { name: "Sacramento", state: "CA", market: "US" },
  { name: "Irvine", state: "CA", market: "US" },
  { name: "Houston", state: "TX", market: "US" },
  { name: "Dallas", state: "TX", market: "US" },
  { name: "Austin", state: "TX", market: "US" },
  { name: "San Antonio", state: "TX", market: "US" },
  { name: "Fort Worth", state: "TX", market: "US" },
  { name: "Orlando", state: "FL", market: "US" },
  { name: "Tampa", state: "FL", market: "US" },
  { name: "Miami", state: "FL", market: "US" },
  { name: "Atlanta", state: "GA", market: "US" },
  { name: "Sydney", state: "NSW", market: "AU" },
  { name: "Parramatta", state: "NSW", market: "AU" },
  { name: "Newtown", state: "NSW", market: "AU" },
  { name: "Melbourne", state: "VIC", market: "AU" },
  { name: "St Kilda", state: "VIC", market: "AU" },
  { name: "Richmond", state: "VIC", market: "AU" },
  { name: "Brisbane", state: "QLD", market: "AU" },
  { name: "Perth", state: "WA", market: "AU" },
  { name: "Adelaide", state: "SA", market: "AU" },
  { name: "Canberra", state: "ACT", market: "AU" },
];

const SKILL_KEYWORDS: { pattern: RegExp; tag: string }[] = [
  { pattern: /\b(bột|acrylic|ombre)\b/i, tag: "Bột/Acrylic" },
  { pattern: /\b(dip|sns)\b/i, tag: "Dip/SNS" },
  { pattern: /\b(gel-?x|biab)\b/i, tag: "Gel-X/Biab" },
  { pattern: /\b(design|nail\s?art|vẽ)\b/i, tag: "Design" },
  { pattern: /\b(mani|pedi|chân\s?tay\s?nước|tay\s?chân\s?nước)\b/i, tag: "Chân tay nước" },
  { pattern: /\bwax\b/i, tag: "Wax" },
];

interface ParsedPost {
  raw: string;
  market: Market | null;
  state: string | null;
  city: string | null;
  salaryAmount: string | null;
  salaryType: string | null;
  skills: string[];
  phoneMasked: string | null;
  salonName: string | null;
}

function extractCityState(text: string): { market: "US" | "AU" | null; state: string | null; city: string | null } {
  for (const hint of CITY_HINTS) {
    const re = new RegExp(`\\b${hint.name.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(text)) return { market: hint.market, state: hint.state, city: hint.name };
  }
  const usMatch = text.match(new RegExp(`\\b(${US_STATES.join("|")})\\b`));
  if (usMatch) return { market: "US", state: usMatch[1], city: null };
  const auMatch = text.match(new RegExp(`\\b(${AU_STATES.join("|")})\\b`));
  if (auMatch) return { market: "AU", state: auMatch[1], city: null };
  return { market: null, state: null, city: null };
}

function extractSalary(text: string): { amount: string | null; type: string | null } {
  // % ăn chia kiểu "60/40" hoặc "ăn chia 60%"
  const splitMatch = text.match(/\b(\d{2})\s?\/\s?(\d{2})\b/);
  const percentMatch = text.match(/(\d{1,3})\s?%\s?(ăn chia|commission)/i);
  if (splitMatch) return { amount: `${splitMatch[1]}/${splitMatch[2]}`, type: "% Ăn chia" };
  if (percentMatch) return { amount: `${percentMatch[1]}%`, type: "% Ăn chia" };

  // $ dollar amount, có thể là range, có thể kèm /hr /tuần /week
  const dollarMatch = text.match(/\$\s?\d[\d,]*(?:\s?[-–]\s?\$?\d[\d,]*)?(?:\s*\/\s*(?:tuần|week|wk|tháng|month|hr|giờ|hour))?/i);
  if (dollarMatch) {
    const raw = dollarMatch[0].replace(/\s+/g, "");
    const isHourly = /\/(hr|giờ|hour)/i.test(raw);
    return { amount: raw, type: isHourly ? "Theo giờ" : "Bao lương" };
  }
  return { amount: null, type: null };
}

function extractSkills(text: string): string[] {
  const found = new Set<string>();
  for (const { pattern, tag } of SKILL_KEYWORDS) {
    if (pattern.test(text)) found.add(tag);
  }
  return [...found];
}

// Che 3 số giữa, giữ đầu + cuối — VD: "+1 832-***-5678" — để khuyến khích
// người xem đăng ký/nhắn tin qua app thay vì gọi thẳng số thô.
function maskPhone(text: string): string | null {
  const usMatch = text.match(/(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/);
  if (usMatch) {
    return `+1 ${usMatch[1]}-***-${usMatch[3]}`;
  }
  const auMatch = text.match(/(?:\+?61[-.\s]?|0)(4\d{2})[-.\s]?(\d{3})[-.\s]?(\d{3})\b/);
  if (auMatch) {
    return `+61 ${auMatch[1]}-***-${auMatch[3]}`;
  }
  return null;
}

function extractSalonName(text: string): string | null {
  const match = text.match(/([A-Z][A-Za-z0-9&''\s]{2,40}?(?:Nails?|Nail Salon|Nail Spa|Spa|Nail Bar|Nail Lounge))/);
  return match ? match[1].trim() : null;
}

function parsePost(raw: string): ParsedPost {
  const { market, state, city } = extractCityState(raw);
  const { amount, type } = extractSalary(raw);
  return {
    raw,
    market: market === "AU" ? Market.AU : market === "US" ? Market.US : null,
    state,
    city,
    salaryAmount: amount,
    salaryType: type,
    skills: extractSkills(raw),
    phoneMasked: maskPhone(raw),
    salonName: extractSalonName(raw),
  };
}

// ============================================================
// 2. FEEDER — insert User(OWNER) + Job vào Turso qua Prisma
// ============================================================

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function feedParsedPost(parsed: ParsedPost, index: number): Promise<"inserted" | "skipped-no-location" | "skipped-duplicate"> {
  if (!parsed.market || !parsed.state) {
    console.log(`  ⚠️  [#${index}] Bỏ qua — không xác định được bang/thị trường.`);
    return "skipped-no-location";
  }

  const city = parsed.city || (parsed.state ? parsed.state : "Chưa rõ");
  const salonName = parsed.salonName || `Tiệm Nail tại ${city}`;
  const phone = parsed.phoneMasked || "+1 000-***-0000";

  const existing = await prisma.job.findFirst({
    where: { salonName, phone },
    select: { id: true },
  });
  if (existing) {
    console.log(`  ⏭️  [#${index}] "${salonName}" (${phone}) đã tồn tại — bỏ qua.`);
    return "skipped-duplicate";
  }

  const emailSlug = `${slugify(salonName)}-${index}`.slice(0, 60);
  const email = `${emailSlug}@feed.pawnailjobs.demo`;
  const hashedPassword = await bcrypt.hash(`Feed@${Math.random().toString(36).slice(2, 10)}`, 10);

  let owner = await prisma.user.findUnique({ where: { email } });
  if (!owner) {
    const initial = encodeURIComponent(salonName.charAt(0).toUpperCase());
    owner = await prisma.user.create({
      data: {
        name: `Chủ ${salonName}`,
        email,
        password: hashedPassword,
        role: Role.OWNER,
        market: parsed.market,
        state: parsed.state,
        city,
        avatarUrl: `https://ui-avatars.com/api/?name=${initial}&background=ec4899&color=ffffff&size=128&bold=true&format=png`,
      },
    });
  }

  const skills = parsed.skills.length > 0 ? parsed.skills : ["Bột/Acrylic"];

  await prisma.job.create({
    data: {
      title: `Cần thợ ${skills.join("/")} gấp`,
      salonName,
      description: parsed.raw.slice(0, 500),
      ownerId: owner.id,
      market: parsed.market,
      state: parsed.state,
      city,
      salaryType: parsed.salaryType || (parsed.market === Market.AU ? "Theo giờ AUD" : "Bao lương tuần"),
      salaryAmount: parsed.salaryAmount || "Thỏa thuận",
      skills: skills.join(","),
      benefits: "",
      phone,
      isUrgent: true,
    },
  });

  console.log(`  ✅ [#${index}] Đã tạo tin: "${salonName}" — ${city}, ${parsed.state} (${parsed.market}) — SĐT ẩn: ${phone}`);
  return "inserted";
}

export async function runPipeline(rawPosts: string[]) {
  console.log(`🔎 Parsing ${rawPosts.length} bài đăng thô...\n`);

  const stats = { inserted: 0, skippedNoLocation: 0, skippedDuplicate: 0 };

  for (let i = 0; i < rawPosts.length; i++) {
    const parsed = parsePost(rawPosts[i]);
    const result = await feedParsedPost(parsed, i + 1);
    if (result === "inserted") stats.inserted++;
    else if (result === "skipped-no-location") stats.skippedNoLocation++;
    else stats.skippedDuplicate++;
  }

  console.log("\n📊 Kết quả:");
  console.log(`   Đã tạo mới: ${stats.inserted}`);
  console.log(`   Bỏ qua (thiếu vị trí): ${stats.skippedNoLocation}`);
  console.log(`   Bỏ qua (trùng): ${stats.skippedDuplicate}`);
}

// ============================================================
// 3. DỮ LIỆU MẪU (hư cấu, để test pipeline chạy được ngay)
// ============================================================

const RAW_POSTS: string[] = [
  `Cần gấp thợ Bột/Dip cho tiệm Lucky Nails ở Garden Grove, CA. Bao lương $1,200-1,400/tuần tuỳ tay nghề, tip hậu. Tiệm đông khách quanh năm. Text/call 714-555-1122 để biết thêm chi tiết. 🙏`,

  `TUYỂN THỢ GẤP GẤP GẤP 🔥 Tiệm Elegant Nail Spa khu Houston, TX cần thợ Gel-X kinh nghiệm, trả $28-32/hr, income ổn định. Liên hệ (832) 555-2244 gặp chị Hoa.`,

  `Tiệm ở Orlando, FL cần thợ chân tay nước full-time hoặc part-time đều được, ăn chia 60/40, khách sang tip cao. Gọi 407-555-3355 nha mọi người.`,

  `📣 Sunshine Nails & Spa tại Atlanta, GA đang cần thợ biết Design và Dip/SNS, bao lương thương lượng theo tay nghề, có chỗ ở cho thợ ở xa. SĐT: (678) 555-4466`,

  `Cần thợ Dip/SNS cho salon ở Sydney, NSW. Trả $35-40/hr tuỳ kinh nghiệm, môi trường làm việc thân thiện. Nhắn tin 0412 555 678 để biết thêm.`,

  `🌟 Golden Nails Melbourne, VIC tuyển thợ Bột Acrylic full-time, bao lương $1,300/tuần, có xe đưa đón khu vực gần tiệm. Liên hệ 0423 555 789.`,

  `Tiệm Brisbane, QLD cần thợ Gel-X/Biab gấp, ăn chia 55%, khách ổn định cả tuần. Gọi hoặc text 0434 555 890 gặp anh Tâm.`,

  `Cần thợ biết Wax và chân tay nước cho tiệm ở Irvine, CA, income tốt, bao lương $1,100/tuần cho người mới, thợ cứng thương lượng thêm. Contact 949-555-5566.`,

  `Perth, WA — tiệm cần thợ all-around (bột, dip, chân tay nước đều được), lương theo giờ $30/hr, ca linh hoạt. Liên hệ 0455 555 901.`,

  `URGENT: Austin, TX tiệm Bella Nails Lounge cần thợ SNS/Dip ngay, bao lương $1,400/tuần + có chỗ ở miễn phí cho thợ ở xa dọn tới. Gọi 512-555-6677.`,
];

// ============================================================
// Chạy trực tiếp khi gọi `npx tsx scripts/scrape-and-feed-nails.ts`
// ============================================================

async function main() {
  await runPipeline(RAW_POSTS);
}

main()
  .catch((err) => {
    console.error("❌ Pipeline thất bại:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
