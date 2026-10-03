-- 2026-10-03: index khóa ngoại / cột lọc (SQLite không tự tạo index cho FK).
-- An toàn khi chạy lại nhiều lần (IF NOT EXISTS), chỉ THÊM index, không đổi dữ liệu.
-- Áp dụng lên Turso production: npx tsx scripts/apply-sql.ts prisma/sql/2026-10-03_add_indexes.sql

CREATE INDEX IF NOT EXISTS "Job_ownerId_idx" ON "Job"("ownerId");
CREATE INDEX IF NOT EXISTS "Job_isUrgent_createdAt_idx" ON "Job"("isUrgent", "createdAt");
CREATE INDEX IF NOT EXISTS "Job_market_state_idx" ON "Job"("market", "state");
CREATE INDEX IF NOT EXISTS "SavedJob_jobId_idx" ON "SavedJob"("jobId");
CREATE INDEX IF NOT EXISTS "TechnicianProfile_market_state_idx" ON "TechnicianProfile"("market", "state");
CREATE INDEX IF NOT EXISTS "UnlockContact_technicianUserId_idx" ON "UnlockContact"("technicianUserId");
CREATE INDEX IF NOT EXISTS "BlockedUser_blockedUserId_idx" ON "BlockedUser"("blockedUserId");
CREATE INDEX IF NOT EXISTS "UserReport_reporterId_idx" ON "UserReport"("reporterId");
CREATE INDEX IF NOT EXISTS "UserReport_reportedUserId_idx" ON "UserReport"("reportedUserId");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX IF NOT EXISTS "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX IF NOT EXISTS "PostLike_userId_idx" ON "PostLike"("userId");
CREATE INDEX IF NOT EXISTS "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");
CREATE INDEX IF NOT EXISTS "PostComment_authorId_idx" ON "PostComment"("authorId");
CREATE INDEX IF NOT EXISTS "SupplyProduct_createdAt_idx" ON "SupplyProduct"("createdAt");
CREATE INDEX IF NOT EXISTS "SupplyProduct_sellerId_idx" ON "SupplyProduct"("sellerId");
CREATE INDEX IF NOT EXISTS "Review_targetUserId_idx" ON "Review"("targetUserId");
