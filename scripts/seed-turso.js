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
  console.log("Seeding database...");

  // 1. Create Spa Owner User
  const employer = await prisma.user.upsert({
    where: { email: "spa@pawbook.vn" },
    update: {},
    create: {
      name: "Spa PawBook Owner",
      email: "spa@pawbook.vn",
      password: "$2a$10$U7vS547B2hH/yP65iV5jbeo.uRUp885G.4t5fA55P3qQz/uU67H4G", // hashed password
      role: "EMPLOYER",
      trustScore: 4.8,
      isVerified: true,
      bio: "Chuyên cung cấp dịch vụ thú cưng chuyên nghiệp.",
    },
  });
  console.log("Seeded employer user:", employer.email);

  // 1b. Create Another Employer (who does not own any jobs)
  const anotherEmployer = await prisma.user.upsert({
    where: { email: "another@pawbook.vn" },
    update: {},
    create: {
      name: "Another Employer",
      email: "another@pawbook.vn",
      password: "$2a$10$U7vS547B2hH/yP65iV5jbeo.uRUp885G.4t5fA55P3qQz/uU67H4G", // hashed password
      role: "EMPLOYER",
      trustScore: 5.0,
      isVerified: false,
      bio: "Không có quan hệ giao dịch với Tester.",
    },
  });
  console.log("Seeded another employer user:", anotherEmployer.email);

  // 2. Create a Job
  const job = await prisma.job.create({
    data: {
      title: "Senior Next.js Developer",
      description: "Yêu cầu kinh nghiệm vững chắc về Nextjs, React và Typescript. Có khả năng tối ưu hóa SEO.",
      salary: "20.000.000đ - 35.000.050đ",
      companyName: "PawBook Solutions",
      employerId: employer.id,
      isBoosted: true,
    },
  });
  console.log("Seeded job:", job.title);

  console.log("Seeding complete! 🎉");
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
