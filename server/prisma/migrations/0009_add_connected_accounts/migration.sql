CREATE TYPE "ConnectedAccountStatus" AS ENUM (
  'NOT_CONNECTED',
  'PENDING',
  'ACTION_REQUIRED',
  'ACTIVE',
  'RESTRICTED'
);

ALTER TABLE "User"
ADD COLUMN "stripeConnectedAccountId" TEXT,
ADD COLUMN "stripeConnectedAccountStatus" "ConnectedAccountStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
ADD COLUMN "stripeConnectedAccountStatusReason" TEXT,
ADD COLUMN "stripeConnectedAccountOnboardedAt" TIMESTAMP(3),
ADD COLUMN "stripeConnectedAccountLastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_stripeConnectedAccountId_key"
ON "User"("stripeConnectedAccountId");
