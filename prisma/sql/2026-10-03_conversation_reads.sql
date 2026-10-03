-- 2026-10-03: bảng ConversationRead cho "tin chưa đọc theo hội thoại", "Đã xem",
-- "Hoạt động x phút trước". CHỈ TẠO BẢNG MỚI — không đổi bảng cũ.
-- An toàn khi chạy lại (IF NOT EXISTS). Code đã deploy tự bỏ qua tính năng này
-- cho tới khi bảng tồn tại, nên chạy trước hay sau khi deploy đều được.
-- Chạy: npx tsx scripts/apply-sql.ts prisma/sql/2026-10-03_conversation_reads.sql

CREATE TABLE IF NOT EXISTS "ConversationRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ConversationRead_conversationId_idx" ON "ConversationRead"("conversationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationRead_userId_conversationId_key" ON "ConversationRead"("userId", "conversationId");
