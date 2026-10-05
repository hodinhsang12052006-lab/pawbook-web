-- Xác minh số điện thoại qua SMS. Chỉ THÊM bảng mới. Chạy:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-07_phone_verification.sql
CREATE TABLE IF NOT EXISTS "PhoneVerification" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
