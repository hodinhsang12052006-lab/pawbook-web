import { PrismaClient, Role } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

// 1. Manually parse .env variables
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

async function main() {
  console.log("=== CREATING ADMIN ACCOUNT ===");

  const adminEmail = "bitpawos30052003@gmail.com";
  const adminPassword = "0794678904";
  const adminId = "10000000001";

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Delete first to avoid primary key update constraint errors and ensure ID is 10000000001
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { id: adminId }
      ]
    }
  });

  if (existingUser) {
    console.log(`Deleting existing user with email "${existingUser.email}" or ID "${existingUser.id}" to avoid key constraint conflicts...`);
    await prisma.user.delete({
      where: { id: existingUser.id }
    });
  }

  const created = await prisma.user.create({
    data: {
      id: adminId,
      name: "BITPAWOS",
      email: adminEmail,
      password: hashedPassword,
      role: Role.ADMIN,
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      bio: "Tài khoản quản trị viên tối cao của hệ thống BitPaw.",
      skills: "admin, moderation, security",
      pawCoin: 99999,
      reputation: 100,
      trustScore: 5.0,
      isVerified: true,
    }
  });
  console.log("Admin created successfully:", created.email, "with ID:", created.id);

  console.log("=== ADMIN SYNC COMPLETE ===");
}

main()
  .catch((err) => {
    console.error("Failed to seed Admin:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
