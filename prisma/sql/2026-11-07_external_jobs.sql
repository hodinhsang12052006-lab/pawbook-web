-- Tin việc từ ĐỐI TÁC (Adzuna) — bảng RIÊNG, không đụng bảng Job (tin tiệm tự đăng / đăng hộ).
-- Chỉ THÊM bảng + index, chạy lại nhiều lần không sao (IF NOT EXISTS).
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-11-07_external_jobs.sql
-- Gỡ: prisma/sql/2026-11-07_external_jobs_restore.sql (xoá bảng + toàn bộ dữ liệu đối tác).
-- Bảng trống cho tới khi đặt EXTERNAL_JOBS_ADZUNA=on + ADZUNA_APP_ID/ADZUNA_APP_KEY trên Vercel.
CREATE TABLE IF NOT EXISTS "ExternalJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "providerJobId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT,
  "locationLabel" TEXT NOT NULL,
  "state" TEXT,
  "city" TEXT,
  "lat" REAL,
  "lng" REAL,
  "salaryMin" INTEGER,
  "salaryMax" INTEGER,
  "salaryCurrency" TEXT,
  "salaryPeriod" TEXT,
  "contractTime" TEXT,
  "contractType" TEXT,
  "snippet" TEXT,
  "redirectUrl" TEXT NOT NULL,
  "providerCreatedAt" DATETIME NOT NULL,
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "hiddenReason" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalJob_provider_providerJobId_key" ON "ExternalJob"("provider", "providerJobId");
CREATE INDEX IF NOT EXISTS "ExternalJob_market_state_idx" ON "ExternalJob"("market", "state");
CREATE INDEX IF NOT EXISTS "ExternalJob_expiresAt_idx" ON "ExternalJob"("expiresAt");
CREATE INDEX IF NOT EXISTS "ExternalJob_dedupeKey_idx" ON "ExternalJob"("dedupeKey");
