-- Độ "nóng" thật của tin tuyển theo ngày (lượt xem + lượt bấm liên hệ).
-- Chỉ THÊM bảng mới, không sửa dữ liệu cũ. Chạy:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-04_job_daily.sql
CREATE TABLE IF NOT EXISTS "JobDaily" (
  "jobId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  "contacts" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("jobId", "day"),
  CONSTRAINT "JobDaily_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "JobDaily_day_idx" ON "JobDaily"("day");
