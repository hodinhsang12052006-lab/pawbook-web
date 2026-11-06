-- 06/11/2026 — Gỡ (chuyển về draft, KHÔNG xoá) 5 bài chính thức "📍 … tiệm đang cần thợ tuần này" đã lỡ liệt kê
-- tiệm DỮ LIỆU MẪU (tài khoản seed …pawnailjobs.demo, VD "Sunny Nails & Spa — San Antonio") như tiệm đang tuyển thật.
-- Nguyên nhân đã sửa ở lib/jobDigestPost.ts (lọc owner = người thật). Chủ chạy: npx tsx scripts/apply-sql.ts <file>
-- Hoàn tác: prisma/sql/2026-11-06b_archive_demo_digests_restore.sql
UPDATE "Post" SET status='draft' WHERE status='published' AND id IN ('c423db513e47ddb4db680dd53','cf444ea4e979b11b14714d612','c5158fb197c84878f911679ca','c1e9a19f71572db59107574f8','cc9976a203e8812d14e4e0efa');
