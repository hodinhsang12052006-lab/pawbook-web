CREATE TABLE IF NOT EXISTS "SmsSend" ("id" TEXT NOT NULL PRIMARY KEY, "phone" TEXT NOT NULL, "ip" TEXT NOT NULL, "purpose" TEXT NOT NULL DEFAULT 'login', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS "SmsSend_phone_createdAt_idx" ON "SmsSend"("phone", "createdAt");
CREATE INDEX IF NOT EXISTS "SmsSend_ip_createdAt_idx" ON "SmsSend"("ip", "createdAt");
CREATE INDEX IF NOT EXISTS "SmsSend_createdAt_idx" ON "SmsSend"("createdAt");
