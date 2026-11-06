-- 2026-11-06: 5 bài "📍 <Bang>: N tiệm đang cần thợ tuần này" của tài khoản chính thức (01–06/11) liệt kê TOÀN tiệm
-- DỮ LIỆU MẪU (tên trùng scripts/seed-nail-data.ts / seed-fill-states.ts: Sunny Nails & Spa, Rose Nails Bar, Ocean
-- Nails & Beauty…) — các tiệm này không có trên bảng việc thật. Lỗi đã sửa trong lib/jobDigestPost.ts (chỉ lấy tin
-- tiệm tự đăng của tài khoản thật). File này CẤT các bài đó về nháp (status='draft'), KHÔNG xoá.
-- Bài điểm tin 12–24/10 lấy từ tin thật → KHÔNG đụng tới.
-- Chạy:  npx tsx scripts/apply-sql.ts prisma/sql/2026-11-06c_hide_demo_job_digests.sql
-- Hoàn tác: prisma/sql/2026-11-06c_hide_demo_job_digests_restore.sql
UPDATE "Post" SET status = 'draft' WHERE status = 'published' AND content LIKE '📍 %' AND id IN ('c423db513e47ddb4db680dd53', 'cf444ea4e979b11b14714d612', 'c5158fb197c84878f911679ca', 'c1e9a19f71572db59107574f8', 'cc9976a203e8812d14e4e0efa');
