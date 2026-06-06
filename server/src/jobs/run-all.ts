import { prisma } from "../config/prisma.js";
import { runCleanupMaintenance } from "./cleanup-maintenance.js";
import { runEmailRetryJob } from "./retry-email-deliveries.js";
import { runOpsReminders } from "./send-ops-reminders.js";

async function main() {
  const [cleanup, reminders, emailRetries] = await Promise.all([
    runCleanupMaintenance(),
    runOpsReminders(),
    runEmailRetryJob()
  ]);

  console.log(JSON.stringify({ cleanup, reminders, emailRetries }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
