const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@libsql/client");
const { PrismaLibSQL } = require("@prisma/adapter-libsql");

// Manually parse .env variables to ensure Prisma Client knows where to look
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
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

let prisma;
if (process.env.TURSO_DATABASE_URL) {
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

async function main() {
  console.log("Starting FOMO seeding process...");

  // 1. Clean old entries to avoid duplicate keys and constraint check failures
  console.log("Cleaning old records...");
  await prisma.comment.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.blogPost.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create the 6 core users (Army of shills / mồi & test user fallbacks)
  console.log("Seeding core users...");

  const testPassword = "$2a$10$U7vS547B2hH/yP65iV5jbeo.uRUp885G.4t5fA55P3qQz/uU67H4G"; // password123

  // Recruiter 1
  const hrTrang = await prisma.user.create({
    data: {
      name: "Nguyễn Thu Trang - Tech Recruiter",
      email: "trang.recruiter@pawbook.vn",
      password: testPassword,
      role: "EMPLOYER",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      trustScore: 4.9,
      isVerified: true,
      bio: "Tìm kiếm các lập trình viên Next.js, Node.js và MMO master cho các dự án tăng trưởng nhanh.",
    }
  });

  // Recruiter 2
  const hrHai = await prisma.user.create({
    data: {
      name: "Lê Hải - HR Manager",
      email: "hai.hr@pawbook.vn",
      password: testPassword,
      role: "EMPLOYER",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
      trustScore: 4.7,
      isVerified: true,
      bio: "Quản lý tuyển dụng nhân sự cho các dự án startup dịch vụ tiện ích.",
    }
  });

  // Recruiter 3 (Test target that owns jobs)
  const hrSpa = await prisma.user.create({
    data: {
      name: "Spa PawBook Owner",
      email: "spa@pawbook.vn",
      password: testPassword,
      role: "EMPLOYER",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
      trustScore: 4.8,
      isVerified: true,
      bio: "Chuyên cung cấp dịch vụ thú cưng chuyên nghiệp.",
    }
  });

  // Recruiter 4 (Test target with NO jobs/relations)
  const hrAnother = await prisma.user.create({
    data: {
      name: "Another Employer",
      email: "another@pawbook.vn",
      password: testPassword,
      role: "EMPLOYER",
      avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
      trustScore: 5.0,
      isVerified: false,
      bio: "Không có quan hệ giao dịch với Tester.",
    }
  });

  // Expert 1
  const devA = await prisma.user.create({
    data: {
      name: "Trần Văn A - Senior Next.js Developer",
      email: "anv@pawbook.vn",
      password: testPassword,
      role: "USER",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      trustScore: 4.9,
      isVerified: true,
      bio: "Next.js core expert. Đam mê tối ưu hóa tốc độ load web và SEO On-page.",
    }
  });

  // Expert 2
  const mmoHoang = await prisma.user.create({
    data: {
      name: "Hoàng MMO - Cày Airdrop Master",
      email: "hoangmmo@pawbook.vn",
      password: testPassword,
      role: "USER",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      trustScore: 4.6,
      isVerified: false,
      bio: "Chuyên cày airdrop các dự án layer 2, viết bot auto tương tác bằng Puppeteer/Python.",
    }
  });

  console.log("Seeded 6 core users.");

  // 3. Create 10 Social/Newsfeed Posts
  console.log("Seeding social posts...");
  const posts = [];

  posts.push(await prisma.post.create({
    data: {
      content: "Anh em cày Airdrop dự án mới lưu ý: Đợt này tụi dự án quét Sybil bằng cách đối chiếu cụm IP và hành vi tương tác trên mạng xã hội rất gắt. Giải pháp tốt nhất là sử dụng proxy xoay vòng từng luồng và bypass Cloudflare bằng puppeteer-extra-plugin-stealth nhé. Chúc anh em húp đậm! 🚀",
      authorId: mmoHoang.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Mẹo nhỏ để Next.js App Router đạt điểm Performance 100/100 trên Lighthouse: Tránh import trực tiếp các icon thư viện lớn vào bundle. Hãy dùng dynamic imports hoặc lấy file SVG trực tiếp để render. Ngoài ra, tối ưu hóa các components tĩnh bằng cách chuyển thành Server Components mặc định.",
      authorId: devA.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Bên công ty mình đang cần tìm 1 bạn Senior Next.js Developer làm việc remote bán thời gian hoặc toàn thời gian. Ưu tiên các bạn đã có kinh nghiệm tối ưu hóa SEO và rành App Router. Mức lương dao động từ 3000$ - 4000$ tùy năng lực. Inbox mình gửi JD chi tiết nhé!",
      authorId: hrTrang.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Hôm nay ngồi setup phễu chuyển đổi cho một dự án landing page MMO ngách tài chính. Kết quả thật bất ngờ, tỉ lệ CTR tăng vọt 35% chỉ sau khi sửa lại nút CTA dạng glassmorphism màu vàng và có hiệu ứng micro-animation phát sáng lấp lánh. Chi tiết template CSS mình chia sẻ dưới phần comment nhé.",
      authorId: devA.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Các bạn ứng viên IT lưu ý: Một chiếc CV ăn điểm nhà tuyển dụng không phải là chiếc CV viết quá dài. Hãy tập trung làm nổi bật: 1. Dự án thực tế bạn đã làm; 2. Chỉ số cải tiến cụ thể (ví dụ: tối ưu API giúp giảm thời gian tải từ 2s xuống 300ms); 3. Link Github/Demo chạy trực tiếp.",
      authorId: hrHai.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Mới cào thành công hơn 50.000 data lead từ các group Facebook ngách MMO bằng tool Python tự viết. Anh em nào cần danh sách email/sđt chất lượng này để chạy ads hoặc cold email thì thả tim rồi inbox mình share free nhé. Chia sẻ vì cộng đồng!",
      authorId: mmoHoang.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Hỏi ngu: Có anh em nào gặp lỗi 'Hydration failed because the initial UI does not match what was rendered on the server' khi dùng state local lưu vào localStorage trên Next.js chưa? Xử lý triệt để như thế nào để không bị nháy giao diện vậy?",
      authorId: devA.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Tech recruitment trends 2026: Các startup công nghệ đang dịch chuyển mạnh sang mô hình tuyển dụng Freelance/Thời vụ chất lượng cao để tối ưu chi phí vận hành. Các bạn freelancer có trust score cao và lý lịch giao dịch uy tín sẽ cực kỳ đắt show trong giai đoạn tới.",
      authorId: hrHai.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Vừa nhận được thông báo chuyển tiền từ VNPAY sau đợt rút hoa hồng affiliate đầu tháng. Nền tảng PawBook tích hợp cổng ví nạp rút nhanh gọn thật sự, phí gas lại siêu rẻ nữa. Anh em cày coin cày cuốc trên này tha hồ yên tâm nhé!",
      authorId: mmoHoang.id,
    }
  }));

  posts.push(await prisma.post.create({
    data: {
      content: "Khoe nhẹ sản phẩm mới làm tối qua: Dashboard tổng hợp số liệu thu chi tự động dùng Next.js, Tailwind CSS và lưu trữ dữ liệu trên Turso Cloud SQLite. Load mượt như nhung, điểm SEO xanh lét, đúng là sự kết hợp hoàn hảo!",
      authorId: devA.id,
    }
  }));

  console.log("Seeded 10 social posts.");

  // 4. Create 8 attractive Jobs
  console.log("Seeding jobs...");

  /*
  await prisma.job.create({
    data: {
      title: "Senior Next.js Developer",
      description: "Yêu cầu kinh nghiệm vững chắc về Nextjs, React và Typescript. Có khả năng tối ưu hóa SEO.",
      salary: "20.000.000đ - 35.000.050đ",
      companyName: "PawBook Solutions",
      employerId: hrSpa.id,
      isBoosted: true,
    }
  });

  await prisma.job.create({
    data: {
      title: "Tuyển Senior ReactJS Lương 3000$",
      description: "Phát triển các SPA và NextJS App Router phục vụ cộng đồng MMO. Yêu cầu tối ưu hiệu năng tốt, có khả năng đọc hiểu code nhanh, viết code sạch.",
      salary: "3,000$ - 4,500$",
      companyName: "Fomo Tech Corp",
      employerId: hrTrang.id,
      isBoosted: true,
    }
  });

  await prisma.job.create({
    data: {
      title: "Tuyển 5 bạn CTV cày Crypto lương ngày",
      description: "Làm việc tại nhà, cày task Airdrop, Retroactive trên các mạng xã hội theo danh sách hướng dẫn có sẵn. Phù hợp cho các bạn học sinh, sinh viên kiếm thêm thu nhập.",
      salary: "500.000đ - 1.500.000đ / ngày",
      companyName: "BitPaw Labs",
      employerId: hrTrang.id,
      isBoosted: false,
    }
  });

  await prisma.job.create({
    data: {
      title: "Remote Backend Developer (Node.js/Python)",
      description: "Xây dựng các microservices cào dữ liệu, xử lý concurrency, quản lý hàng ngàn VPS/Proxy và bảo trì hạ tầng API của công ty. Có kiến thức về Docker và AWS là lợi thế lớn.",
      salary: "2,500$ - 3,500$",
      companyName: "PawBook Solutions",
      employerId: hrTrang.id,
      isBoosted: true,
    }
  });

  await prisma.job.create({
    data: {
      title: "Kế toán dịch vụ thuế doanh nghiệp",
      description: "Thực hiện lập báo cáo tài chính, kê khai và quyết toán thuế thu nhập doanh nghiệp hàng quý/năm cho các dự án SME của công ty đối tác.",
      salary: "10.000.000đ - 15.000.000đ",
      companyName: "Vinasun Finance",
      employerId: hrTrang.id,
      isBoosted: false,
    }
  });

  await prisma.job.create({
    data: {
      title: "Spa Thú Cưng Professional Groomer",
      description: "Cắt tỉa lông thú cưng, tắm sấy chó mèo và chăm sóc da lông thú cưng chuyên nghiệp tại chuỗi salon PawSpa Quận 1.",
      salary: "12.000.000đ - 18.000.000đ",
      companyName: "PawSpa Grooming",
      employerId: hrHai.id,
      isBoosted: false,
    }
  });

  await prisma.job.create({
    data: {
      title: "Nhân Viên Lắp Đặt Điện Lạnh Dân Dụng",
      description: "Khảo sát địa hình, tư vấn lắp đặt, sửa chữa và vệ sinh bảo trì điều hòa nhiệt độ, máy giặt, tủ lạnh tận nơi cho khách hàng.",
      salary: "15.000.000đ - 20.000.000đ",
      companyName: "Điện Lạnh Bách Khoa",
      employerId: hrHai.id,
      isBoosted: true,
    }
  });

  await prisma.job.create({
    data: {
      title: "Thợ Xây Dựng / Thi Công Sửa Nhà",
      description: "Nhận thi công các hạng mục xây trát, ốp lát, sơn bả cải tạo sửa chữa chung cư, nhà phố khu vực nội thành Hà Nội.",
      salary: "15.000.000đ - 22.000.000đ",
      companyName: "DecoHouse Group",
      employerId: hrHai.id,
      isBoosted: false,
    }
  });
  */

  console.log("Seeded 8 jobs.");

  // 5. Create interactions (comments between shill users)
  console.log("Seeding comments and interactions...");

  await prisma.comment.create({
    data: {
      content: "Quá chuẩn luôn anh ơi, bài viết cực kỳ tâm huyết. Em đã thử bypass và tỷ lệ thành công tăng rõ rệt!",
      postId: posts[0].id,
      authorId: devA.id,
    }
  });

  await prisma.comment.create({
    data: {
      content: "Tuyệt vời, cảm ơn anh Hoàng đã chia sẻ! Rất cần những kiến thức thực chiến thế này.",
      postId: posts[0].id,
      authorId: hrTrang.id,
    }
  });

  await prisma.comment.create({
    data: {
      content: "Lỗi này do Next.js cố render HTML khác với DOM của trình duyệt. Cách fix là dùng dynamic import với `{ ssr: false }` hoặc dùng useEffect để set state sau khi component mount nhé bác.",
      postId: posts[6].id,
      authorId: mmoHoang.id,
    }
  });

  await prisma.comment.create({
    data: {
      content: "Đúng cái em đang tìm kiếm bấy lâu nay! Cám ơn anh A rất nhiều.",
      postId: posts[1].id,
      authorId: mmoHoang.id,
    }
  });

  await prisma.comment.create({
    data: {
      content: "Đã inbox gửi CV ứng tuyển rồi nha chị Trang ơi, check giúp em với ạ.",
      postId: posts[2].id,
      authorId: devA.id,
    }
  });

  console.log("Seeded comments.");
  console.log("FOMO Database seeding completed successfully! 🚀");
}

main()
  .catch(err => {
    console.error("Error during FOMO seeding:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
