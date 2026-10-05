-- Giữ chân người dùng: "Ai đã xem hồ sơ bạn" + "Báo việc theo tiêu chí".
-- Chỉ THÊM bảng mới. Chạy:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-06_retention.sql
CREATE TABLE IF NOT EXISTS "ProfileView" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "viewerId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProfileView_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileView_viewerId_profileId_day_key" ON "ProfileView"("viewerId", "profileId", "day");
CREATE INDEX IF NOT EXISTS "ProfileView_profileId_createdAt_idx" ON "ProfileView"("profileId", "createdAt");

CREATE TABLE IF NOT EXISTS "JobAlert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "state" TEXT,
  "skill" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "JobAlert_market_state_idx" ON "JobAlert"("market", "state");
CREATE INDEX IF NOT EXISTS "JobAlert_userId_idx" ON "JobAlert"("userId");
