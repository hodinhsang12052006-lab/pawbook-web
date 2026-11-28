-- Gỡ mục SANG TIỆM: xoá bảng SalonSale và TOÀN BỘ tin sang tiệm (không khôi phục được).
--   npx tsx scripts/apply-sql.ts prisma/sql/2026-11-28_salon_sales_restore.sql
DROP TABLE IF EXISTS "SalonSale";
