-- Mục SANG TIỆM (bán / sang tiệm nail) — bảng RIÊNG, không đụng bảng Job. Khớp model SalonSale (prisma/schema.prisma).
-- Chỉ THÊM bảng + index, chạy lại nhiều lần không sao (IF NOT EXISTS).
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-11-28_salon_sales.sql
-- Gỡ: prisma/sql/2026-11-28_salon_sales_restore.sql (xoá bảng + toàn bộ tin sang tiệm).
CREATE TABLE IF NOT EXISTS "SalonSale" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "salonName" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "city" TEXT NOT NULL DEFAULT '',
  "address" TEXT,
  "zip" TEXT,
  "askingPrice" INTEGER,
  "monthlyRent" INTEGER,
  "monthlyRevenue" INTEGER,
  "chairs" INTEGER,
  "tables" INTEGER,
  "sqft" INTEGER,
  "phone" TEXT NOT NULL,
  "mediaUrls" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'active',
  "source" TEXT,
  "sourceUrl" TEXT,
  "sourceKey" TEXT,
  "sourceFbHash" TEXT,
  "sourcePostedAt" DATETIME,
  "repostCount" INTEGER NOT NULL DEFAULT 1,
  "lastRepostedAt" DATETIME,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalonSale_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SalonSale_market_state_idx" ON "SalonSale"("market", "state");
CREATE INDEX IF NOT EXISTS "SalonSale_status_expiresAt_idx" ON "SalonSale"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "SalonSale_ownerId_idx" ON "SalonSale"("ownerId");
CREATE INDEX IF NOT EXISTS "SalonSale_phone_idx" ON "SalonSale"("phone");
CREATE INDEX IF NOT EXISTS "SalonSale_sourceKey_idx" ON "SalonSale"("sourceKey");
