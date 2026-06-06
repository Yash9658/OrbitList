ALTER TABLE "Transaction"
ADD COLUMN "sellerPayoutLastAttemptAt" TIMESTAMP(3),
ADD COLUMN "sellerPayoutFailureReason" TEXT;
