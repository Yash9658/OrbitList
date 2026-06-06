CREATE TABLE "DisputeEvidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'participants',
    "kind" TEXT NOT NULL DEFAULT 'file',
    "fileUrl" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisputeCaseEvent" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeCaseEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisputeEvidence_disputeId_createdAt_idx" ON "DisputeEvidence"("disputeId", "createdAt");
CREATE INDEX "DisputeEvidence_submittedById_createdAt_idx" ON "DisputeEvidence"("submittedById", "createdAt");
CREATE INDEX "DisputeCaseEvent_disputeId_createdAt_idx" ON "DisputeCaseEvent"("disputeId", "createdAt");
CREATE INDEX "DisputeCaseEvent_actorUserId_createdAt_idx" ON "DisputeCaseEvent"("actorUserId", "createdAt");

ALTER TABLE "DisputeEvidence"
ADD CONSTRAINT "DisputeEvidence_disputeId_fkey"
FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisputeEvidence"
ADD CONSTRAINT "DisputeEvidence_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DisputeCaseEvent"
ADD CONSTRAINT "DisputeCaseEvent_disputeId_fkey"
FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisputeCaseEvent"
ADD CONSTRAINT "DisputeCaseEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
