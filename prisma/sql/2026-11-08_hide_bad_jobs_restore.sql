-- Hoàn tác prisma/sql/2026-11-08_hide_bad_jobs.sql: trả expiresAt của đúng 3 tin về giá trị GỐC đã cất nguyên văn trong
-- AppSetting "hidden_bad_jobs_2026_11_08" (kể cả NULL của tin tự đăng cũ), rồi xoá bản cất. Chưa chạy file ẩn (không có
-- bản cất) → không đổi gì. Lưu ý: hoàn tác = 3 tin hiện lại với SĐT cũ (trang tin vẫn ẩn số không gọi được ở thị trường).
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-11-08_hide_bad_jobs_restore.sql
UPDATE "Job" SET "expiresAt" = json_extract((SELECT "value" FROM "AppSetting" WHERE "key" = 'hidden_bad_jobs_2026_11_08'), '$.' || "id")
WHERE "id" IN ('cmw6ix2te0002l7072razday9', 'cmw58w60o0002gz08u9vphi8v', 'cmv9m3p070002jm06glq8d4fx')
  AND EXISTS (SELECT 1 FROM "AppSetting" WHERE "key" = 'hidden_bad_jobs_2026_11_08');
DELETE FROM "AppSetting" WHERE "key" = 'hidden_bad_jobs_2026_11_08';
