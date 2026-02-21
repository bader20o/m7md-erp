import { runDatabaseBackup } from "../lib/backup";
import { prisma } from "../lib/prisma";

const oneDayMs = 24 * 60 * 60 * 1000;

async function tick(): Promise<void> {
  try {
    await runDatabaseBackup();
    console.log("Daily backup completed at", new Date().toISOString());
  } catch (error) {
    console.error("Daily backup failed:", error);
  }
}

async function main(): Promise<void> {
  await tick();
  setInterval(() => {
    void tick();
  }, oneDayMs);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

