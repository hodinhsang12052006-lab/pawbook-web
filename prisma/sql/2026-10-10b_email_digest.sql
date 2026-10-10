-- Email tóm tắt hằng tuần: cài đặt nhận + mốc gửi lần cuối. Chỉ THÊM cột. Chạy:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-10b_email_digest.sql
ALTER TABLE "User" ADD COLUMN "emailDigest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "lastDigestAt" DATETIME;
