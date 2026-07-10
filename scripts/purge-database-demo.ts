import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
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
  console.log("=== DB PURGE PROCESS ===");

  // 1. Delete Prisma tables (Job, Service, Gig, Bid, Review)
  console.log("Purging jobs from database...");
  await prisma.job.deleteMany({});

  console.log("Purging services from database...");
  await prisma.service.deleteMany({});

  // 2. Clear SQL Store table
  console.log("Purging Store table...");
  const sqlDeleteStore = `DELETE FROM "Store";`;
  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    try {
      await libsql.execute(sqlDeleteStore);
      console.log("Successfully cleared Store table on Turso cloud database.");
    } catch (e: any) {
      console.error("Failed to clear Store table on Turso:", e.message);
    } finally {
      libsql.close();
    }
  } else {
    try {
      await prisma.$executeRawUnsafe(sqlDeleteStore);
      console.log("Successfully cleared Store table on SQLite local.");
    } catch (e: any) {
      console.error("Failed to clear Store table on local SQLite:", e.message);
    }
  }

  console.log("=== DB PURGE COMPLETE ===");
}

main()
  .catch((err) => {
    console.error("Purge crashed:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
