ALTER TABLE "Report" ALTER COLUMN "listingId" DROP NOT NULL;

ALTER TABLE "Report" ADD COLUMN "reportedUserId" TEXT;

ALTER TABLE "Report"
ADD CONSTRAINT "Report_reportedUserId_fkey"
FOREIGN KEY ("reportedUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "Report_reportedUserId_status_idx" ON "Report"("reportedUserId", "status");
