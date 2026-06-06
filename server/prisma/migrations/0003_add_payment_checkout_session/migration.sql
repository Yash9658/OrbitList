ALTER TABLE "Payment"
ADD COLUMN "stripeCheckoutSessionId" TEXT;

CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key"
ON "Payment"("stripeCheckoutSessionId");
