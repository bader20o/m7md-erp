BEGIN;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assignedById_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assignedToId_fkey";
ALTER TABLE "TaskSubmission" DROP CONSTRAINT IF EXISTS "TaskSubmission_employeeId_fkey";
ALTER TABLE "TaskSubmission" DROP CONSTRAINT IF EXISTS "TaskSubmission_taskId_fkey";
ALTER TABLE "TaskImage" DROP CONSTRAINT IF EXISTS "TaskImage_submissionId_fkey";

DROP TABLE IF EXISTS "TaskImage";
DROP TABLE IF EXISTS "TaskSubmission";

ALTER TABLE "Task"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "employeeNote" TEXT,
ADD COLUMN "adminNote" TEXT;

UPDATE "Task"
SET "createdById" = "assignedById"
WHERE "createdById" IS NULL;

UPDATE "Task" AS t
SET "assignedToId" = e."userId"
FROM "Employee" AS e
WHERE t."assignedToId" = e."id";

CREATE TYPE "TaskStatus_new" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "dueAt" DROP NOT NULL;
ALTER TABLE "Task"
ALTER COLUMN "status" TYPE "TaskStatus_new"
USING (
  CASE "status"::text
    WHEN 'NOT_STARTED' THEN 'TODO'
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
    WHEN 'SUBMITTED' THEN 'DONE'
    WHEN 'APPROVED' THEN 'DONE'
    WHEN 'REJECTED' THEN 'BLOCKED'
    WHEN 'OVERDUE' THEN 'BLOCKED'
    ELSE 'TODO'
  END
)::"TaskStatus_new";

ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "TaskStatus_old";

UPDATE "Task"
SET "completedAt" = COALESCE("completedAt", "updatedAt")
WHERE "status" = 'DONE';

ALTER TABLE "Task"
DROP COLUMN "assignedAt",
DROP COLUMN "assignedById",
DROP COLUMN "requireImages";

ALTER TABLE "Task" ALTER COLUMN "createdById" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';

DROP INDEX IF EXISTS "Task_assignedById_idx";
DROP INDEX IF EXISTS "Task_assignedToId_status_idx";
DROP INDEX IF EXISTS "Task_status_idx";
DROP INDEX IF EXISTS "Task_assignedToId_idx";

CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");
CREATE INDEX "Task_status_idx" ON "Task"("status");

ALTER TABLE "Task"
ADD CONSTRAINT "Task_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
