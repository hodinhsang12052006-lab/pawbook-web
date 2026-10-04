-- Ảnh / video tiệm đính kèm tin tuyển. Chỉ THÊM bảng mới. Chạy:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-05_job_media.sql
CREATE TABLE IF NOT EXISTS "JobMedia" (
  "jobId" TEXT NOT NULL PRIMARY KEY,
  "mediaUrls" TEXT NOT NULL,
  CONSTRAINT "JobMedia_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
