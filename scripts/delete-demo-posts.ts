import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import fs from "fs";
import path from "path";

// Load env variables
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
  console.log("=== REMOVING DEMO CONTENT & ACCOUNTS ===");

  // Delete posts matching the "Nguyễn Văn A" or "PawBook" demo strings
  const deletedPosts = await prisma.post.deleteMany({
    where: {
      OR: [
        { content: { contains: "Nguyễn Văn A" } },
        { content: { contains: "Hôm nay chính thức khởi động dự án 'PawBook'" } },
        { content: { contains: "UI/UX của PawBook cũng đã hoàn thiện" } },
        { author: { name: "Nguyễn Văn A" } }
      ]
    }
  });

  console.log(`Deleted ${deletedPosts.count} demo posts from the database.`);

  // Delete user "Nguyễn Văn A" if exists
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      name: "Nguyễn Văn A"
    }
  });

  console.log(`Deleted ${deletedUsers.count} demo users named 'Nguyễn Văn A'.`);
  console.log("=== CLEANUP SUCCESS ===");
}

main()
  .catch((err) => {
    console.error("Cleanup script error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
