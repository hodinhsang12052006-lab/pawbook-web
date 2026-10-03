// Chạy 1 file .sql lên database Turso trong .env (TURSO_DATABASE_URL).
// Dùng cho thay đổi schema dạng "chỉ thêm" như index — prisma db push không
// chạy thẳng được với URL libsql://.
//   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-03_add_indexes.sql
import fs from "fs";
import { createClient } from "@libsql/client";

// Không ghi đè biến đã có sẵn trong môi trường.
process.loadEnvFile?.(".env");

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    throw new Error("Cách dùng: npx tsx scripts/apply-sql.ts <file.sql>");
  }
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Thiếu TURSO_DATABASE_URL trong .env");

  const statements = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  console.log(`Áp dụng ${statements.length} câu lệnh lên ${url} ...`);
  for (const sql of statements) {
    await db.execute(sql);
    console.log("✓", sql.slice(0, 90));
  }
  console.log("Xong.");
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
