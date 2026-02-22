import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { BackupStatus } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const execAsync = promisify(exec);

function getRetentionCount(): number {
  return env.BACKUP_RETENTION_COUNT;
}

export async function runDatabaseBackup(initiatedById?: string): Promise<void> {
  const backupRow = await prisma.backup.create({
    data: {
      status: BackupStatus.RUNNING,
      initiatedById,
      retentionDays: 30
    }
  });

  try {
    const backupDir = path.join(process.cwd(), "backups");
    await fs.mkdir(backupDir, { recursive: true });

    const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;
    const filePath = path.join(backupDir, fileName);
    const command = `pg_dump "${process.env.DATABASE_URL}" -Fc -f "${filePath}"`;

    await execAsync(command);
    const fileStat = await fs.stat(filePath);

    await prisma.backup.update({
      where: { id: backupRow.id },
      data: {
        status: BackupStatus.SUCCESS,
        storageKey: `backups/${fileName}`,
        fileSizeBytes: BigInt(fileStat.size),
        completedAt: new Date()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backup error";
    await prisma.backup.update({
      where: { id: backupRow.id },
      data: {
        status: BackupStatus.FAILED,
        completedAt: new Date(),
        errorMessage: message
      }
    });
    throw error;
  }

  await pruneOldBackups(getRetentionCount());
}

export async function pruneOldBackups(retentionCount: number): Promise<void> {
  const successfulBackups = await prisma.backup.findMany({
    where: { status: BackupStatus.SUCCESS },
    orderBy: { completedAt: "desc" }
  });

  if (successfulBackups.length <= retentionCount) {
    return;
  }

  const stale = successfulBackups.slice(retentionCount);

  for (const backup of stale) {
    if (backup.storageKey) {
      const filePath = path.join(process.cwd(), backup.storageKey);
      await fs.rm(filePath, { force: true });
    }

    await prisma.backup.delete({
      where: { id: backup.id }
    });
  }
}

export async function restoreDatabaseBackup(backupId: string, restoredById?: string): Promise<void> {
  const backup = await prisma.backup.findUnique({
    where: { id: backupId },
    select: { id: true, status: true }
  });

  if (!backup) {
    throw new Error("Backup not found.");
  }

  if (backup.status !== BackupStatus.SUCCESS) {
    throw new Error("Only successful backups can be restored.");
  }

  // This records restore intent/metadata. Database restore execution is environment-specific.
  await prisma.backup.update({
    where: { id: backupId },
    data: {
      restoredById: restoredById ?? null,
      restoredAt: new Date()
    }
  });
}

