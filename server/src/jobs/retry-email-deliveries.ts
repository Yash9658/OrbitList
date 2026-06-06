import { prisma } from "../config/prisma.js";
import { createAuditLog } from "../modules/audit/audit.service.js";
import { retryPendingEmailDeliveries } from "../modules/email/email.service.js";

export async function runEmailRetryJob() {
  const result = await retryPendingEmailDeliveries();

  await createAuditLog({
    action: "job.email_retry_run",
    entityType: "job",
    entityId: "retry-email-deliveries",
    metadata: result
  });

  return result;
}

if (process.argv[1]?.includes("retry-email-deliveries")) {
  runEmailRetryJob()
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
