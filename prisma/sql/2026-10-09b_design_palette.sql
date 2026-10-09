-- Mẫu nail: bảng màu + dáng móng + hiệu ứng → app tự vẽ minh hoạ khi chưa có
-- ảnh AI (Gemini miễn phí chỉ viết chữ). Chỉ THÊM cột. Chạy 1 lần:
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-10-09b_design_palette.sql
ALTER TABLE "NailDesign" ADD COLUMN "palette" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "NailDesign" ADD COLUMN "shape" TEXT NOT NULL DEFAULT 'almond';
ALTER TABLE "NailDesign" ADD COLUMN "finish" TEXT NOT NULL DEFAULT 'glossy';
