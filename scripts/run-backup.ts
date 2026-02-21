import { runDatabaseBackup } from "../lib/backup";
import { prisma } from "../lib/prisma";

async function main(): Promise<void> {
  await runDatabaseBackup();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Backup failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });

