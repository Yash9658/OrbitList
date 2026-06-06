-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM (
  'NOT_READY',
  'PENDING_RELEASE',
  'RELEASED',
  'REFUND_PENDING',
  'REFUNDED',
  'BLOCKED'
);

-- AlterTable
ALTER TABLE "Transaction"
ADD COLUMN "refundIssuedAt" TIMESTAMP(3),
ADD COLUMN "refundReference" TEXT,
ADD COLUMN "sellerPayoutReference" TEXT,
ADD COLUMN "sellerPayoutReleasedAt" TIMESTAMP(3),
ADD COLUMN "sellerPayoutStatus" "PayoutStatus" NOT NULL DEFAULT 'NOT_READY';

-- AlterTable
ALTER TABLE "Dispute"
ADD COLUMN "adminInternalNotes" TEXT,
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal';
