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
  console.log("Initializing Mock Crawler engine...");

  // Query existing employers to attach to crawled jobs
  const employers = await prisma.user.findMany({
    where: { role: "EMPLOYER" },
  });

  if (employers.length === 0) {
    console.error("Error: No employers found in database. Please run seeding first.");
    process.exit(1);
  }

  const getRandomEmployer = () => employers[Math.floor(Math.random() * employers.length)].id;

  const mockJobsData = [
    // FNB (5 jobs)
    {
      title: "Nhân viên phục vụ quán cà phê acoustic",
      description: "Chào đón khách hàng, ghi chép order đồ uống, phục vụ trà nước và chuẩn bị không gian biểu diễn ca nhạc buổi tối.",
      salary: "4.000.000đ - 6.500.000đ",
      companyName: "Sound & Brew Cafe",
      niche: "FNB",
      latitude: 10.7782,
      longitude: 106.6975, // Q1 HCMC
      ai_tags: "serving, coffee, customer-service, hospitality",
    },
    {
      title: "Phụ bếp nhà hàng lẩu nướng Hàn Quốc",
      description: "Hỗ trợ sơ chế nguyên liệu thịt bò, rau củ quả, chuẩn bị nước sốt lẩu nướng và rửa bát đĩa công nghiệp ca tối.",
      salary: "6.000.000đ - 8.500.000đ",
      companyName: "K-BBQ Delight",
      niche: "FNB",
      latitude: 21.0264,
      longitude: 105.8502, // Hoan Kiem HN
      ai_tags: "kitchen-assistant, food-prep, cleanliness, teamwork",
    },
    {
      title: "Barista pha chế ca tối",
      description: "Pha chế các dòng cà phê máy Ý, trà sữa, trà trái cây và các loại nước ép theo menu của quán. Quản lý quầy bar sạch sẽ.",
      salary: "25.000đ - 35.000đ / giờ",
      companyName: "Vibe Coffee Roasters",
      niche: "FNB",
      latitude: 10.7812,
      longitude: 106.7024, // Q1 HCMC
      ai_tags: "barista, coffee-brewing, latte-art, cleanliness",
    },
    {
      title: "Thu ngân chuỗi cửa hàng bánh ngọt",
      description: "Chào đón khách, nhập hóa đơn vào máy POS, thanh toán tiền mặt/chuyển khoản và đóng gói bánh mang về cho khách.",
      salary: "5.500.000đ - 7.000.000đ",
      companyName: "Sweetie Bakery",
      niche: "FNB",
      latitude: 21.0315,
      longitude: 105.8567, // Hoan Kiem HN
      ai_tags: "cashier, pos-billing, basic-math, customer-care",
    },
    {
      title: "Nhân viên nướng thịt BBQ bắp bò",
      description: "Thực hiện nướng trực tiếp các loại thịt nướng tại lò hoặc trực tiếp tại bàn ăn phục vụ khách hàng chu đáo.",
      salary: "6.500.000đ - 8.000.000đ",
      companyName: "Gogi House Express",
      niche: "FNB",
      latitude: 10.7741,
      longitude: 106.6991, // Q1 HCMC
      ai_tags: "grill-cook, bbq-烤肉, serving, customer-service",
    },

    // SPA (5 jobs)
    {
      title: "Kỹ thuật viên gội đầu dưỡng sinh",
      description: "Thực hiện gội đầu dưỡng sinh, massage đầu vai cổ gáy và đắp mặt nạ thảo dược chăm sóc da cho khách hàng.",
      salary: "8.000.000đ - 12.000.000đ",
      companyName: "Sen Spa & Wellness",
      niche: "SPA",
      latitude: 10.7761,
      longitude: 106.7042, // Q1 HCMC
      ai_tags: "hair-wash, body-massage, skincare, wellness",
    },
    {
      title: "Nhân viên làm móng Nail & Art",
      description: "Thiết kế vẽ móng tay chân nghệ thuật, sơn gel, đắp bột móng giả và chăm sóc da tay chân cho khách hàng chuyên nghiệp.",
      salary: "10.000.000đ - 15.000.000đ",
      companyName: "Charm Nail Lounge",
      niche: "SPA",
      latitude: 21.0253,
      longitude: 105.8589, // Hoan Kiem HN
      ai_tags: "nail-art, manicure, pedicure, beauty-care",
    },
    {
      title: "Massage trị liệu chuyên sâu",
      description: "Thực hiện xoa bóp bấm huyệt trị liệu, xông hơi đá nóng giải độc và phục hồi cơ bắp toàn thân cho khách du lịch.",
      salary: "12.000.000đ - 18.000.000đ",
      companyName: "Traditional Herbal Spa",
      niche: "SPA",
      latitude: 10.7798,
      longitude: 106.6953, // Q1 HCMC
      ai_tags: "body-massage, therapy, acupressure, hot-stone",
    },
    {
      title: "Chuyên viên triệt lông & tắm trắng",
      description: "Vận hành máy triệt lông laser diode cao cấp, thực hiện các quy trình làm sạch và tắm trắng body cho khách hàng nữ.",
      salary: "9.000.500đ - 13.000.000đ",
      companyName: "Seoul Beauty Academy",
      niche: "SPA",
      latitude: 21.0278,
      longitude: 105.8522, // Hoan Kiem HN
      ai_tags: "laser-hair-removal, skin-whitening, body-care, equipment",
    },
    {
      title: "Tư vấn viên mỹ phẩm và liệu trình",
      description: "Đón tiếp khách hàng, soi da phân tích tình trạng da, tư vấn bán các dòng mỹ phẩm chăm sóc da mặt cao cấp.",
      salary: "8.000.000đ + % Doanh số",
      companyName: "La Roche Cosmetics Store",
      niche: "SPA",
      latitude: 10.7753,
      longitude: 106.7018, // Q1 HCMC
      ai_tags: "consultant, skincare, cosmetic-sales, communication",
    },

    // MECHANIC (5 jobs)
    {
      title: "Thợ sửa xe máy Honda chuyên nghiệp",
      description: "Khắc phục các sự cố về động cơ xe ga, xe số, thay dầu nhớt, nhông xích và bảo dưỡng tổng quát xe máy cho khách.",
      salary: "12.000.000đ - 18.000.000đ",
      companyName: "Honda Head Motor",
      niche: "MECHANIC",
      latitude: 10.7712,
      longitude: 106.6961, // Q1 HCMC
      ai_tags: "sua-xe-may, oil-change, engine-repair, maintenance",
    },
    {
      title: "Nhân viên cứu hộ lốp xe ô tô 24/7",
      description: "Thực hiện cứu hộ lưu động vá lốp, thay lốp sơ cua, kích bình ắc quy xe ô tô bị hỏng dọc đường nội thành Hà Nội.",
      salary: "14.000.000đ - 22.000.000đ",
      companyName: "Hanoi Car Rescue 247",
      niche: "MECHANIC",
      latitude: 21.0299,
      longitude: 105.8533, // Hoan Kiem HN
      ai_tags: "tire-patching, battery-boost, emergency, roadside-help",
    },
    {
      title: "Thợ phụ sửa máy gầm ô tô",
      description: "Hỗ trợ thợ chính tháo lắp động cơ xe ô tô, kiểm tra hệ thống treo gầm, bôi trơn máy móc và sắp xếp dụng cụ cơ khí sạch sẽ.",
      salary: "8.000.000đ - 11.000.000đ",
      companyName: "Thanh Dat Auto Garage",
      niche: "MECHANIC",
      latitude: 10.7824,
      longitude: 106.7039, // Q1 HCMC
      ai_tags: "engine-repair, mechanical, automotive-prep, maintenance",
    },
    {
      title: "Lắp đặt và vệ sinh máy lạnh tại nhà",
      description: "Lắp ráp điều hòa nhiệt độ, nạp gas, kiểm tra sự cố ống đồng rò rỉ nước, và bảo trì dàn nóng dàn lạnh sạch sẽ cho hộ gia đình.",
      salary: "15.000.000đ - 20.000.000đ",
      companyName: "Dien Lanh Bach Khoa",
      niche: "MECHANIC",
      latitude: 21.0245,
      longitude: 105.8519, // Hoan Kiem HN
      ai_tags: "air-con, clean, install, gas-refill",
    },
    {
      title: "Sửa chữa máy pha cà phê công nghiệp",
      description: "Thực hiện sửa chữa bo mạch, vệ sinh hệ thống bơm nước, kiểm tra áp suất lò hơi máy pha cà phê cho các chuỗi quán.",
      salary: "13.000.000đ - 17.500.000đ",
      companyName: "Barista Gears Repair",
      niche: "MECHANIC",
      latitude: 10.7766,
      longitude: 106.6999, // Q1 HCMC
      ai_tags: "espresso-machine, electronics-repair, pump-cleaning, espresso",
    },

    // IT (5 jobs)
    {
      title: "Junior Frontend Developer (React/Tailwind)",
      description: "Cắt giao diện HTML/CSS sang React Components, tích hợp API RESTful, tối ưu UX responsive trên mobile & tablet.",
      salary: "15.000.000đ - 22.000.000đ",
      companyName: "PawBook Development Agency",
      niche: "IT",
      latitude: 10.7725,
      longitude: 106.6934, // Q1 HCMC
      ai_tags: "react, tailwindcss, javascript, responsive-ux",
    },
    {
      title: "Python Web Scraper Engineer",
      description: "Lập trình bot cào thông tin bất động sản, thương mại điện tử dùng Scrapy, BeautifulSoup, bypass anti-bot Cloudflare.",
      salary: "20.000.000đ - 35.000.000đ",
      companyName: "MMO Data Solutions",
      niche: "IT",
      latitude: 21.0333,
      longitude: 105.8555, // Hoan Kiem HN
      ai_tags: "python, beautifulsoup, scrapy, cloudflare-bypass",
    },
    {
      title: "UI/UX Figma Designer",
      description: "Thiết kế Wireframe, UI/UX Mockup cho các ứng dụng Web/App đa nền tảng. Xây dựng Design System đồng bộ trên Figma.",
      salary: "18.000.000đ - 28.000.000đ",
      companyName: "Pixel Perfect Agency",
      niche: "IT",
      latitude: 10.7791,
      longitude: 106.6922, // Q1 HCMC
      ai_tags: "figma, ui-ux-design, wireframes, design-system",
    },
    {
      title: "DevOps Engineer (Docker/CI-CD)",
      description: "Đóng gói container Docker, cấu hình GitHub Actions CI-CD, quản lý VPS, thiết lập reverse proxy Nginx kết nối SSL.",
      salary: "30.000.000đ - 45.000.000đ",
      companyName: "CloudScale Systems",
      niche: "IT",
      latitude: 21.0267,
      longitude: 105.8488, // Hoan Kiem HN
      ai_tags: "docker, ci-cd, nginx-ssl, vps-deployment",
    },
    {
      title: "QA Automation Tester (Playwright)",
      description: "Viết kịch bản test tự động bằng NodeJS & Playwright. Tích hợp chạy kiểm thử tự động trên pull request.",
      salary: "18.000.000đ - 25.000.000đ",
      companyName: "QA Masters Agency",
      niche: "IT",
      latitude: 10.7749,
      longitude: 106.7058, // Q1 HCMC
      ai_tags: "playwright, automation-tests, javascript, ci-run",
    },
  ];

  console.log(`Crawling and inserting ${mockJobsData.length} multi-niche jobs into Turso...`);

  for (let i = 0; i < mockJobsData.length; i++) {
    const jobData = mockJobsData[i];
    const employerId = getRandomEmployer();

    await prisma.job.create({
      data: {
        title: jobData.title,
        description: jobData.description,
        salary: jobData.salary,
        companyName: jobData.companyName,
        employerId: employerId,
        niche: jobData.niche,
        latitude: jobData.latitude,
        longitude: jobData.longitude,
        ai_tags: jobData.ai_tags,
        isBoosted: Math.random() > 0.7, // Randomly boost 30% of jobs for organic FOMO
      },
    });

    console.log(`[${i + 1}/${mockJobsData.length}] Inserted: ${jobData.title} (${jobData.niche})`);
  }

  console.log("Mock Crawler synchronization finished! Turso database is populated with multi-niche jobs. 🚀");
}

main()
  .catch(err => {
    console.error("Mock Crawler failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
