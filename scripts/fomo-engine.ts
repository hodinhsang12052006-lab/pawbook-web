import { PrismaClient, Role } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import fs from "fs";
import path from "path";

// 1. Parse environmental configurations
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

let prisma: PrismaClient;
if (process.env.TURSO_DATABASE_URL) {
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql as any);
  prisma = new PrismaClient({ adapter: adapter as any });
} else {
  prisma = new PrismaClient();
}

// 50 realistic Vietnamese names
const CLONE_NAMES = [
  "Tuấn MMO", "Lan HR", "Khang Thợ Xe", "Hương Du Lịch", "Minh Grab",
  "Bảo Coder", "Trang Spa", "Duy Crypto", "Phượng Tuyển Dụng", "Nam Tiện Ích",
  "Hoàng Lập Trình", "Mai Nhân Sự", "Kiệt Sửa Khóa", "Yến Khách Sạn", "Hải Giao Hàng",
  "Quân Backend", "Linh Nail Spa", "Hùng Airdrop", "Thảo Headhunter", "Cường Tài Xế",
  "Đức Frontend", "Vân PetGrooming", "Long TradeCoin", "Nga Recruiter", "Bình Ba Gác",
  "Tùng Fullstack", "Oanh Thẩm Mỹ", "Tấn MMO Master", "Hạnh HR Manager", "Thắng Xe Tải",
  "Sơn Dev", "Hồng Spa & Clinic", "Phúc Solona", "Cúc Tuyển Dụng IT", "Khoa Shipper",
  "Vinh Web3", "Nguyệt Massage", "Lâm Affilate", "Tuyết HR Lead", "Thịnh Dịch Vụ",
  "Phương React", "Trúc Thú Y", "Quang MMO Newbie", "Kim Săn Nhân Tài", "Thành Vận Tải",
  "Hiếu Python", "Hà Cún Miêu Spa", "Trung MMO Builder", "Vy HR Tech", "Kiên Tự Do"
];

// Unsplash profile picture sources
const AVATAR_POOL = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
];

// Content Matrix: Real pains (văn phong đời thường, không robot)
const CONTENT_TEMPLATES = [
  // Việc làm & MMO
  "Cay thật sự anh em ơi! Làm outsource cho ông dev kia xong việc rồi ổng khất nợ lương cả tháng nay không trả. Inbox thì seen xong kêu dự án chưa giải ngân. Red flag to đùng né gấp nha mọi người!",
  "Mới đi phỏng vấn bên quận 3 về. HR hỏi xoáy đáp xoay cả tiếng đồng hồ, bắt làm bài test mút chỉ xong bảo chờ kết quả. Cuối cùng im lặng luôn, đúng là phí thời gian.",
  "Tin vui đầu ngày! Em vừa chốt được job freelance thiết kế landing page cho bên đại lý du lịch, nhận cọc 50% luôn rồi. Công nhận chịu khó build uy tín trên này có quả ngọt ngay.",
  "Làm MMO ròng rã 3 tháng trời, tài khoản ads cứ lên là die. Hôm qua đổi sang proxy dân cư của bác chia sẻ trong group thì chạy mượt hẳn. Húp nhẹ được 500$ đầu tiên rồi anh em ạ!",
  "Bên công ty mình đang tuyển gấp 3 bạn CTV đăng bài tìm việc làm & dịch vụ tại Nha Trang. Việc nhẹ lương ngày, không cần kinh nghiệm, có tài liệu hướng dẫn từ A đến Z nhé.",
  "Đời dev khổ lắm các bác. Sếp kêu tối ưu lại cái API map load cho mượt mà không cho nâng cấp server. Ngồi fix query muốn hói đầu mới giảm được tí latency.",
  "Mấy nay thấy phong trào cày coin Airdrop xôm tụ quá, có bác nào chia sẻ tool auto click bypass cloudflare uy tín chút được không? Đang muốn dựng dàn VPS cày thử.",
  "Né gấp công ty công nghệ gia đình nha anh em. Vào làm mà sếp tổng là chồng, kế toán là vợ, trưởng phòng là em họ. KPI thì ép trên trời mà lương trễ liên tục.",

  // Du lịch Nha Trang
  "Vừa từ Nha Trang về mà ấm ức quá. Đặt cái phòng homestay gần biển trên app thấy hình lung linh lắm, tới nơi thì phòng ẩm mốc, điều hòa hỏng, cách âm kém. Nói chung treo đầu dê bán thịt chó!",
  "Hỏi nhỏ anh em Nha Trang: Có quán hải sản nào tươi ngon khu Tháp Bà mà bán đúng giá, không chặt chém du khách không ạ? Sợ mấy vụ vô ăn xong hóa đơn tính tiền triệu lắm rồi.",
  "Review resort 5 sao Nha Trang siêu rẻ cho anh em đi trốn nóng. Đợt này họ đang kích cầu du lịch nên book combo phòng + buffet sáng rẻ dã man. Bãi biển riêng sạch bóng không một cọng rác.",
  "Mùa này Nha Trang nắng đẹp dã man, mỗi tội đông khách du lịch quá. Đi tắm biển mà người đông như kiến cỏ, chụp tấm hình toàn dính người khác.",
  "Có ai biết địa chỉ thuê xe máy uy tín ở ga Nha Trang không ạ? Yêu cầu xe đời mới chút chứ đi mấy xe nát chạy leo dốc hòn Chồng run tay lắm.",

  // Dịch vụ Thú cưng / Xe ôm
  "Đêm hôm 12h đêm bé cún nhà em bị ngộ độc nôn mửa liên tục mà cuống cuồng không biết gọi phòng khám thú y nào cấp cứu 24/7. May nhờ app radar quét được một tiệm cách nhà 2km chạy vội qua cứu kịp.",
  "Bực mình ghê! Sáng nay vội đi làm đặt xe ôm ngoài đường thì bị hét giá gấp đôi bình thường. Kêu là xăng tăng giá với giờ cao điểm. Từ nay cạch mặt, cứ bật app lên đặt cho minh bạch.",
  "Cho em hỏi tiệm spa thú cưng nào ở quận 1 cắt tỉa lông với tắm sấy chó mèo uy tín nhẹ tay tí ạ? Bé mèo nhà em nhát lắm, đi tiệm cũ về bị trầy xước cả tai xót hết cả ruột.",
  "Dịch vụ tắm sấy chó mèo tận nhà mùa này đắt khách ghê. Tiện lợi đỡ phải chở bé đi xa nắng nôi, giá cả nhỉnh hơn tí nhưng cún cưng thoải mái là ok rồi.",
  "Hôm nay chạy xe ôm chở khách mang theo cái lồng mèo to đùng. Đường kẹt nhưng mèo cứ kêu ngoao ngoao làm cả đoạn đường ai cũng nhìn cười. Thấy vui vui!",
  "Cảnh báo tiệm phụ kiện chó mèo giá rẻ khu vực Bình Thạnh. Bán hạt thức ăn cận date làm cún nhà em ăn vô bị tiêu chảy mất mấy ngày liền. Mọi người mua đồ nhớ check kỹ date nhé.",
  "Nhận chở thú cưng (chó mèo lợn kiểng) đi spa hoặc đi khám bệnh bằng xe máy có rào chắn an toàn nha mọi người. Khu vực Sài Gòn giá hạt dẻ, tài xế siêu yêu động vật."
];

// Helper to pick random item
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  console.log("=== FOMO AUTO CONTENT ENGINE ===");

  // 1. Ensure 50 clone users exist in database
  console.log("Syncing clone users...");
  const cloneUsers = [];
  
  for (let i = 0; i < CLONE_NAMES.length; i++) {
    const name = CLONE_NAMES[i];
    const email = `clone${i + 1}@pawbook.vn`;
    const avatarUrl = randomItem(AVATAR_POOL);

    try {
      const user = await prisma.user.upsert({
        where: { email },
        update: {}, // Keep existing if already present
        create: {
          name,
          email,
          password: "$2a$10$U7vS547B2hH/yP65iV5jbeo.uRUp885G.4t5fA55P3qQz/uU67H4G", // password123
          role: Role.USER,
          avatarUrl,
          bio: `Thành viên tích cực chia sẻ kinh nghiệm trên mạng xã hội BitPaw.`,
          pawCoin: 200,
          reputation: 20,
          trustScore: 4.8,
          isVerified: Math.random() > 0.8, // 20% verified badge chance
        }
      });
      cloneUsers.push(user);
    } catch (err: any) {
      console.error(`Failed to sync clone user ${name}: ${err.message}`);
    }
  }

  console.log(`Successfully synced ${cloneUsers.length} clone users in database.`);

  if (cloneUsers.length === 0) {
    console.error("No clone users available. Exiting Fomo Engine.");
    return;
  }

  // 2. Generate and inject 10 to 20 random posts spread across the last 24 hours
  const postsCount = Math.floor(Math.random() * 11) + 10; // 10 to 20 posts
  console.log(`Generating and inserting ${postsCount} realistic FOMO posts...`);

  let successfulInserts = 0;
  
  for (let i = 0; i < postsCount; i++) {
    const author = randomItem(cloneUsers);
    const content = randomItem(CONTENT_TEMPLATES);

    // Randomize time inside the last 24h
    const currentMillis = Date.now();
    const randomHoursAgo = Math.random() * 24;
    const createdAtDate = new Date(currentMillis - randomHoursAgo * 60 * 60 * 1000);

    try {
      await prisma.post.create({
        data: {
          content,
          authorId: author.id,
          createdAt: createdAtDate
        }
      });
      successfulInserts++;
      console.log(`  📝 [${successfulInserts}/${postsCount}] Created post by "${author.name}" dated ${createdAtDate.toLocaleTimeString()}`);
    } catch (err: any) {
      console.error(`Failed to insert post by ${author.name}: ${err.message}`);
    }
  }

  console.log(`\n=== STAGE COMPLETE. Successfully seeded ${successfulInserts} FOMO posts! 🚀 ===`);
}

main()
  .catch((err) => {
    console.error("Fomo Engine crash:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
