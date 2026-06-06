import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { createAuditLog } from "../modules/audit/audit.service.js";
import { subDays } from "./job-utils.js";

function buildBackupFileName() {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return `orbitlist-${timestamp}.dump`;
}

async function pruneOldBackups(backupDir: string) {
  const fileNames = await readdir(backupDir);
  let removedCount = 0;

  for (const fileName of fileNames) {
    if (!fileName.endsWith(".dump")) {
      continue;
    }

    const filePath = path.join(backupDir, fileName);
    const fileStats = await stat(filePath);

    if (fileStats.mtime < subDays(env.DATABASE_BACKUP_RETENTION_DAYS)) {
      await rm(filePath, { force: true });
      removedCount += 1;
    }
  }

  return removedCount;
}

function runPgDump(databaseUrl: string, outputFilePath: string) {
  const pgDumpBinary = env.PG_DUMP_PATH?.trim() || "pg_dump";

  return new Promise<void>((resolve, reject) => {
    const child = spawn(pgDumpBinary, ["--format=custom", "--file", outputFilePath, databaseUrl], {
      stdio: "inherit"
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`pg_dump exited with status ${code ?? "unknown"}`));
    });
  });
}

export async function runDatabaseBackup() {
  const backupDir = path.resolve(process.cwd(), env.DATABASE_BACKUP_DIR);
  await mkdir(backupDir, { recursive: true });

  const outputFilePath = path.join(backupDir, buildBackupFileName());
  await runPgDump(env.DATABASE_URL, outputFilePath);
  const removedCount = await pruneOldBackups(backupDir);

  await createAuditLog({
    action: "job.database_backup_created",
    entityType: "job",
    entityId: "backup-database",
    metadata: {
      outputFilePath,
      retentionDays: env.DATABASE_BACKUP_RETENTION_DAYS,
      removedCount
    }
  });

  return {
    outputFilePath,
    retentionDays: env.DATABASE_BACKUP_RETENTION_DAYS,
    removedCount
  };
}

if (process.argv[1]?.includes("backup-database")) {
  runDatabaseBackup()
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
