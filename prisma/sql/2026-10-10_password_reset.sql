-- Đặt lại mật khẩu qua email. Chỉ THÊM bảng mới. Chạy:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-10_password_reset.sql
CREATE TABLE IF NOT EXISTS "PasswordReset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordReset_userId_createdAt_idx" ON "PasswordReset"("userId", "createdAt");
