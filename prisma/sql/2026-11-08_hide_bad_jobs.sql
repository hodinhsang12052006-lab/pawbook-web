-- 2026-11-08: ẨN (KHÔNG xoá) đúng 3 tin tuyển có SĐT sai thị trường — tìm thấy khi soát production 07/11:
--   cmw6ix2te0002l7072razday9  bài nhóm nail ở ANH ("Shop mình ở shenfield cách Stratford 20p tàu", số Anh 07xxx xxxxxx)
--                              bị bot đăng thành tin Mỹ / CA với số (747) … (tool cắt số 0 đầu → số Mỹ của người lạ)
--   cmw58w60o0002gz08u9vphi8v  bài nhóm nail ở ANH ("Shop gần bến tàu international Stratford DLR", số Anh 07xxx xxxxxx)
--                              bị đăng thành tin Mỹ / NV với số (775) …
--   cmv9m3p070002jm06glq8d4fx  tin tự đăng "Xuân xanh" (New York, NY) mang số Việt Nam "+1 03xxxxxxxx" (không gọi được ở Mỹ)
-- Lỗi code đã sửa (lib/phoneFormat.ts parseMarketPhone, lib/jobIngest/parse.ts foreignMarketSignal, prepareIngest,
-- POST /api/jobs, tin mồi lúc đăng ký): bài ngoài Mỹ / Úc bị bỏ có lý do; số không hợp lệ ở thị trường của tin bị từ chối.
--
-- Cách ẩn = cơ chế hạn tin sẵn có (giống scripts/jobs-hide-uncallable.mts): expiresAt = createdAt của chính dòng đó
-- (đã qua, cùng định dạng ngày Prisma đã ghi) → tin rời bảng việc / tìm kiếm / thông báo / sitemap; trang tin hiện
-- "đã hết hạn". Dữ liệu tin giữ nguyên. Giá trị expiresAt GỐC của 3 dòng (kể cả NULL của tin tự đăng cũ) được cất
-- NGUYÊN VĂN vào AppSetting "hidden_bad_jobs_2026_11_08" TRƯỚC khi đổi → hoàn tác chính xác.
-- Chạy lại nhiều lần an toàn (ON CONFLICT DO NOTHING giữ bản cất đầu tiên; UPDATE chỉ chạy khi đã cất).
--
-- Chạy:     npx tsx scripts/apply-sql.ts prisma/sql/2026-11-08_hide_bad_jobs.sql
-- Hoàn tác: npx tsx scripts/apply-sql.ts prisma/sql/2026-11-08_hide_bad_jobs_restore.sql
-- Kiểm tra: SELECT "id", "expiresAt", "createdAt" FROM "Job" WHERE "id" IN ('cmw6ix2te0002l7072razday9', 'cmw58w60o0002gz08u9vphi8v', 'cmv9m3p070002jm06glq8d4fx')
INSERT INTO "AppSetting" ("key", "value", "updatedAt")
SELECT 'hidden_bad_jobs_2026_11_08', json_group_object("id", "expiresAt"), CAST(strftime('%s','now') AS INTEGER) * 1000
FROM "Job"
WHERE "id" IN ('cmw6ix2te0002l7072razday9', 'cmw58w60o0002gz08u9vphi8v', 'cmv9m3p070002jm06glq8d4fx')
ON CONFLICT("key") DO NOTHING;
UPDATE "Job" SET "expiresAt" = "createdAt"
WHERE "id" IN ('cmw6ix2te0002l7072razday9', 'cmw58w60o0002gz08u9vphi8v', 'cmv9m3p070002jm06glq8d4fx')
  AND EXISTS (SELECT 1 FROM "AppSetting" WHERE "key" = 'hidden_bad_jobs_2026_11_08');
