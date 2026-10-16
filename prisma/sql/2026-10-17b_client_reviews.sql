ALTER TABLE "BookingRequest" ADD COLUMN "reviewToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "BookingRequest_reviewToken_key" ON "BookingRequest"("reviewToken");
CREATE TABLE IF NOT EXISTS "ClientReview" ("id" TEXT NOT NULL PRIMARY KEY, "techId" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "rating" INTEGER NOT NULL, "comment" TEXT, "displayName" TEXT NOT NULL, "itemName" TEXT, "hidden" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ClientReview_techId_fkey" FOREIGN KEY ("techId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX IF NOT EXISTS "ClientReview_bookingId_key" ON "ClientReview"("bookingId");
CREATE INDEX IF NOT EXISTS "ClientReview_techId_createdAt_idx" ON "ClientReview"("techId", "createdAt");
