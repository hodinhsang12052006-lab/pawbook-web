-- Gỡ hẳn bảng tin đối tác (VD giấy phép Adzuna kết thúc và muốn xoá sạch dữ liệu ngay, không chờ cron).
-- Trước khi chạy: đặt EXTERNAL_JOBS_ADZUNA=off trên Vercel để code không đọc / ghi bảng này nữa.
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-11-07_external_jobs_restore.sql
DROP INDEX IF EXISTS "ExternalJob_provider_market_hiddenReason_expiresAt_idx";
DROP INDEX IF EXISTS "ExternalJob_dedupeKey_idx";
DROP INDEX IF EXISTS "ExternalJob_expiresAt_idx";
DROP INDEX IF EXISTS "ExternalJob_market_state_idx";
DROP INDEX IF EXISTS "ExternalJob_provider_providerJobId_key";
DROP TABLE IF EXISTS "ExternalJob";
