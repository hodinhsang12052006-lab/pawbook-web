-- 2026-11-06: bật "Duyệt mẫu trước khi đăng" (designs_review = 1): mẫu máy tạo mỗi ngày vào nháp, admin duyệt rồi mới đăng.
-- Tắt lại: đổi '1' thành '0' (hoặc bấm công tắc trong /admin/studio). updatedAt lưu dạng mili-giây như Prisma.
INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES ('designs_review', '1', CAST(strftime('%s','now') AS INTEGER) * 1000) ON CONFLICT("key") DO UPDATE SET "value" = '1', "updatedAt" = CAST(strftime('%s','now') AS INTEGER) * 1000;
