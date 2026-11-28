-- LỊCH LÀM VIỆC trong nhóm chat (model GroupShift). Chỉ THÊM bảng + index, chạy lại nhiều lần không sao.
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-11-29_group_shifts.sql
-- Gỡ: DROP TABLE IF EXISTS "GroupShift";
CREATE TABLE IF NOT EXISTS "GroupShift" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "start" TEXT NOT NULL,
  "end" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GroupShift_conversationId_date_idx" ON "GroupShift"("conversationId", "date");
CREATE INDEX IF NOT EXISTS "GroupShift_userId_date_idx" ON "GroupShift"("userId", "date");
