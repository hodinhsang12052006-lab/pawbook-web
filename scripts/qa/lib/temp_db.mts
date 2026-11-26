// Nạp TRƯỚC lib/prisma (import đầu tiên của bài test): tạo SQLite TẠM đúng schema hiện tại (prisma db push) và đặt
// globalThis.prisma → lib/prisma dùng client này thay cho "file:./dev.db" (bản trong git cũ, thiếu cột → P2022).
// Không bao giờ đụng prisma/dev.db hay Turso production.
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Chỉ chạy trên SQLite local — TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= …");
const file = path.join(os.tmpdir(), `pawnail_unit_${process.pid}_${Date.now()}.db`).replace(/\\/g, "/");
const url = `file:${file}`;
execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
export const tempDb = new PrismaClient({ datasources: { db: { url } } });
(globalThis as unknown as { prisma: PrismaClient }).prisma = tempDb;
