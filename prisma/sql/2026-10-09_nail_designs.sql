-- "Mẫu nail AI mỗi ngày". Chỉ THÊM bảng mới. Chạy:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-09_nail_designs.sql
CREATE TABLE IF NOT EXISTS "NailDesign" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "day" TEXT NOT NULL,
  "market" TEXT NOT NULL DEFAULT 'US',
  "occasion" TEXT,
  "title" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL,
  "skills" TEXT NOT NULL,
  "difficulty" INTEGER NOT NULL,
  "minutes" INTEGER NOT NULL,
  "priceHint" TEXT NOT NULL,
  "materials" TEXT NOT NULL,
  "steps" TEXT NOT NULL,
  "imageUrl" TEXT,
  "videoUrl" TEXT,
  "provider" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "publishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NailDesign_status_publishedAt_idx" ON "NailDesign"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "NailDesign_day_idx" ON "NailDesign"("day");

CREATE TABLE IF NOT EXISTS "NailDesignSave" (
  "userId" TEXT NOT NULL,
  "designId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "designId"),
  CONSTRAINT "NailDesignSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NailDesignSave_designId_fkey" FOREIGN KEY ("designId") REFERENCES "NailDesign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "NailDesignSave_designId_idx" ON "NailDesignSave"("designId");
