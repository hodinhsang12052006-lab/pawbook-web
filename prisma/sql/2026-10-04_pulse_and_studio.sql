-- "Nhịp đau tuần" + bài PawNail Studio đã duyệt. Chỉ THÊM bảng mới. Chạy:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-04_pulse_and_studio.sql
CREATE TABLE IF NOT EXISTS "PulseVote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "week" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "option" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "market" TEXT,
  "state" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PulseVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PulseVote_userId_week_key" ON "PulseVote"("userId", "week");
CREATE INDEX IF NOT EXISTS "PulseVote_week_questionId_idx" ON "PulseVote"("week", "questionId");
CREATE TABLE IF NOT EXISTS "StudioPost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "market" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "StudioPost_createdAt_idx" ON "StudioPost"("createdAt");
