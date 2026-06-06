CREATE TYPE "IdentityVerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "IdentityVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "legalName" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "country" TEXT,
  "documentType" TEXT,
  "documentNumberLast4" TEXT,
  "addressLine1" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "documentUrl" TEXT,
  "notes" TEXT,
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdentityVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentityVerification_userId_key" ON "IdentityVerification"("userId");
CREATE INDEX "IdentityVerification_status_createdAt_idx" ON "IdentityVerification"("status", "createdAt");
CREATE INDEX "IdentityVerification_reviewedById_idx" ON "IdentityVerification"("reviewedById");

ALTER TABLE "IdentityVerification"
  ADD CONSTRAINT "IdentityVerification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdentityVerification"
  ADD CONSTRAINT "IdentityVerification_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
