// SQLite TẠM đúng schema cho bài test tsx: `prisma db push` vào 1 file trong thư mục tạm của máy rồi gắn vào
// globalThis.prisma (lib/prisma dùng bản này nếu đã có) → KHÔNG đụng prisma/dev.db (file có trong git, có thể cũ schema),
// KHÔNG đụng Turso. Gọi TRƯỚC khi import bất kỳ module nào dùng lib/prisma (dùng `await import(...)` sau dòng này).
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export function useTempSqlite(prefix: string) {
  if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Chỉ chạy trên SQLite local — env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN …");
  const dbFile = path.join(os.tmpdir(), `pawnail_${prefix}_${Date.now()}.db`).replace(/\\/g, "/");
  const url = `file:${dbFile}`;
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const db = new PrismaClient({ datasources: { db: { url } } });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = db;
  const cleanup = async () => {
    await db.$disconnect().catch(() => {});
    for (const f of [dbFile, `${dbFile}-journal`]) {
      try { fs.rmSync(f, { force: true }); } catch {}
    }
  };
  return { db, dbFile, cleanup };
}
