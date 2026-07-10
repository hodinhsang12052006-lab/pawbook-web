import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clear existing messages, bids, services, jobs, users to prevent duplicate keys
  await prisma.bid.deleteMany({});
  await prisma.gig.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.user.deleteMany({});

  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. Candidate User
  const candidate = await prisma.user.create({
    data: {
      name: "Trần Thế Bảo (Candidate)",
      email: "candidate@pawbook.vn",
      password: hashedPassword,
      role: Role.USER,
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      skills: "nextjs, react, typescript, automation, python",
      bio: "Đam mê lập trình Next.js và xây dựng các bot tự động hóa thu thập dữ liệu.",
      pawCoin: 500,
      reputation: 15,
      trustScore: 4.8,
      isVerified: true,
    },
  });

  // 2. HR Recruiter User
  const recruiter = await prisma.user.create({
    data: {
      name: "Nguyễn Thị Mai (HR Manager)",
      email: "hr@pawbook.vn",
      password: hashedPassword,
      role: Role.EMPLOYER,
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
      bio: "Trưởng phòng nhân sự PawBook Solutions chuyên săn lùng nhân tài IT/MMO.",
      pawCoin: 1000,
      reputation: 25,
      trustScore: 4.9,
      isVerified: true,
    },
  });

  // 3. Spa Owner User
  const spaOwner = await prisma.user.create({
    data: {
      name: "Phạm Minh Hạnh (Spa Owner)",
      email: "spa@pawbook.vn",
      password: hashedPassword,
      role: Role.EMPLOYER,
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80",
      bio: "Chủ sở hữu chuỗi cơ sở An Nhiên Spa chuyên massage trị liệu cổ vai gáy.",
      pawCoin: 800,
      reputation: 12,
      trustScore: 4.5,
      isVerified: false,
    },
  });

  /*
  // 4. Sample Jobs posted by HR
  await prisma.job.create({
    data: {
      title: "Senior Next.js Developer",
      companyName: "PawBook Solutions",
      description: "Yêu cầu kinh nghiệm vững chắc về Nextjs, React và Typescript. Có khả năng tối ưu hóa SEO.",
      salary: "20.000.000đ - 35.000.050đ",
      employerId: recruiter.id,
      isBoosted: true,
    },
  });

  await prisma.job.create({
    data: {
      title: "Python Automation Engineer",
      companyName: "MMO Automation Inc",
      description: "Xây dựng các crawler/bot automation bằng Python. Ưu tiên ứng viên biết puppeteer/selenium.",
      salary: "15.000.000đ - 25.000.000đ",
      employerId: recruiter.id,
    },
  });

  // 5. Sample Service posted by Spa Owner
  await prisma.service.create({
    data: {
      name: "An Nhiên Spa Cầu Giấy",
      category: "Spa",
      description: "Liệu trình massage xoa bóp bấm huyệt trị liệu đau vai gáy chuyên sâu bằng tinh dầu thảo mộc.",
      location: "15 Cầu Giấy, Hà Nội",
      contactInfo: "0968686868",
      priceRange: "300.000đ - 600.000đ",
      rating: 4.7,
      ownerId: spaOwner.id,
      isBoosted: true,
    },
  });
  */

  console.log("Seeding complete! Provisioned Candidate, HR, Spa Owner.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
