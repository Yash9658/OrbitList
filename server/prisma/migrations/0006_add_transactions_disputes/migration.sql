CREATE TYPE "TransactionStatus" AS ENUM (
  'PENDING_PAYMENT',
  'FUNDS_SECURED',
  'HANDOFF_SUBMITTED',
  'BUYER_REVIEW',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
  'REFUNDED'
);

CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED_FOR_BUYER',
  'RESOLVED_FOR_SELLER',
  'CLOSED'
);

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "agreedPrice" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "buyerNotes" TEXT,
  "sellerNotes" TEXT,
  "handoffNotes" TEXT,
  "reviewDeadlineAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "openedById" TEXT NOT NULL,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "resolutionNotes" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Transaction_stripeCheckoutSessionId_key" ON "Transaction"("stripeCheckoutSessionId");
CREATE INDEX "Transaction_buyerId_status_createdAt_idx" ON "Transaction"("buyerId", "status", "createdAt");
CREATE INDEX "Transaction_sellerId_status_createdAt_idx" ON "Transaction"("sellerId", "status", "createdAt");
CREATE INDEX "Transaction_listingId_createdAt_idx" ON "Transaction"("listingId", "createdAt");
CREATE INDEX "Dispute_transactionId_createdAt_idx" ON "Dispute"("transactionId", "createdAt");
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_openedById_fkey"
  FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
