-- Hoàn tác prisma/sql/2026-11-06c_hide_demo_job_digests.sql: đăng lại 5 bài điểm tin việc đã cất về nháp.
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-11-06c_hide_demo_job_digests_restore.sql
UPDATE "Post" SET status = 'published' WHERE status = 'draft' AND content LIKE '📍 %' AND id IN ('c423db513e47ddb4db680dd53', 'cf444ea4e979b11b14714d612', 'c5158fb197c84878f911679ca', 'c1e9a19f71572db59107574f8', 'cc9976a203e8812d14e4e0efa');
