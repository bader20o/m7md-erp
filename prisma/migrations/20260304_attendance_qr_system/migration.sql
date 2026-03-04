ALTER TYPE "AttendanceType" RENAME VALUE 'IN' TO 'CHECK_IN';
ALTER TYPE "AttendanceType" RENAME VALUE 'OUT' TO 'CHECK_OUT';

CREATE TYPE "AttendanceEventStatus" AS ENUM ('ACCEPTED', 'REJECTED');
CREATE TYPE "AttendanceDayStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "AttendanceDay" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "workedMinutes" INTEGER,
    "status" "AttendanceDayStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDay_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AttendanceEvent"
    ADD COLUMN "dayKey" TEXT,
    ADD COLUMN "status" "AttendanceEventStatus" NOT NULL DEFAULT 'ACCEPTED',
    ADD COLUMN "rejectReason" TEXT,
    ADD COLUMN "ipAddress" TEXT,
    ADD COLUMN "userAgent" TEXT;

UPDATE "AttendanceEvent"
SET "dayKey" = TO_CHAR("occurredAt", 'YYYY-MM-DD')
WHERE "dayKey" IS NULL;

ALTER TABLE "AttendanceEvent"
    ALTER COLUMN "dayKey" SET NOT NULL,
    DROP COLUMN "latitude",
    DROP COLUMN "longitude",
    DROP COLUMN "geoNote",
    DROP COLUMN "qrPayload";

CREATE UNIQUE INDEX "AttendanceDay_employeeId_dayKey_key" ON "AttendanceDay"("employeeId", "dayKey");
CREATE INDEX "AttendanceDay_dayKey_idx" ON "AttendanceDay"("dayKey");
CREATE INDEX "AttendanceEvent_employeeId_dayKey_idx" ON "AttendanceEvent"("employeeId", "dayKey");
CREATE INDEX "AttendanceEvent_occurredAt_idx" ON "AttendanceEvent"("occurredAt");

ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AttendanceDay" (
    "id",
    "employeeId",
    "dayKey",
    "checkInAt",
    "checkOutAt",
    "workedMinutes",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "employeeId",
    TO_CHAR("checkInAt", 'YYYY-MM-DD'),
    "checkInAt",
    "checkOutAt",
    CASE
        WHEN "checkOutAt" IS NULL THEN NULL
        ELSE GREATEST(FLOOR(EXTRACT(EPOCH FROM ("checkOutAt" - "checkInAt")) / 60), 0)::INTEGER
    END,
    CASE
        WHEN "checkOutAt" IS NULL THEN 'OPEN'::"AttendanceDayStatus"
        ELSE 'CLOSED'::"AttendanceDayStatus"
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Attendance"
ON CONFLICT ("employeeId", "dayKey") DO NOTHING;
