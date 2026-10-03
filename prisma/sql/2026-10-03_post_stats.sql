-- 2026-10-03: bảng PostStat — lượt xem THẬT của bài đăng (mỗi thiết bị 1 lần/ngày).
-- CHỈ TẠO BẢNG MỚI. Code đã deploy tự ẩn lượt xem cho tới khi bảng tồn tại.
-- Chạy: npx tsx scripts/apply-sql.ts prisma/sql/2026-10-03_post_stats.sql

CREATE TABLE IF NOT EXISTS "PostStat" (
    "postId" TEXT NOT NULL PRIMARY KEY,
    "views" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostStat_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
