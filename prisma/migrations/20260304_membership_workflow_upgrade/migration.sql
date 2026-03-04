CREATE TYPE "MembershipOrderStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED', 'EXPIRED');

ALTER TABLE "MembershipOrder" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "MembershipOrder"
ALTER COLUMN "status" TYPE "MembershipOrderStatus_new"
USING (
  CASE
    WHEN "status"::text = 'ACTIVE' THEN 'ACTIVE'
    WHEN "status"::text = 'EXPIRED' THEN 'EXPIRED'
    WHEN "status"::text = 'SUSPENDED' THEN 'CANCELLED'
    ELSE 'PENDING'
  END
)::"MembershipOrderStatus_new";

DROP TYPE "MembershipOrderStatus";
ALTER TYPE "MembershipOrderStatus_new" RENAME TO "MembershipOrderStatus";

ALTER TABLE "MembershipPlan"
ADD COLUMN "durationMonths" INTEGER NOT NULL DEFAULT 12;

UPDATE "MembershipPlan"
SET "durationMonths" = GREATEST(1, ROUND("durationDays" / 30.0)::INTEGER);

ALTER TABLE "MembershipOrder"
ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "approvedByAdminId" TEXT,
ADD COLUMN "rejectedByAdminId" TEXT,
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "deliveryCompanyName" TEXT,
ADD COLUMN "deliveryPhone" TEXT,
ADD COLUMN "deliveryTrackingCode" TEXT,
ADD COLUMN "deliveryNote" TEXT;

UPDATE "MembershipOrder"
SET
  "requestedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "approvedAt" = CASE
    WHEN "status" = 'ACTIVE' THEN COALESCE("startDate", "createdAt")
    ELSE "approvedAt"
  END,
  "expiresAt" = COALESCE("endDate", "expiresAt"),
  "paidAt" = CASE
    WHEN "status" = 'ACTIVE' THEN COALESCE("paidAt", "startDate", "createdAt")
    ELSE "paidAt"
  END;

CREATE TABLE "MembershipBenefit" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL,
  "descriptionEn" TEXT,
  "descriptionAr" TEXT,
  "limitCount" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MembershipBenefit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipOrderBenefit" (
  "id" TEXT NOT NULL,
  "membershipOrderId" TEXT NOT NULL,
  "planBenefitId" TEXT,
  "code" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL,
  "descriptionEn" TEXT,
  "descriptionAr" TEXT,
  "limitCount" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MembershipOrderBenefit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipBenefitUse" (
  "id" TEXT NOT NULL,
  "membershipOrderId" TEXT NOT NULL,
  "membershipOrderBenefitId" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedByAdminId" TEXT NOT NULL,
  "confirmNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MembershipBenefitUse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipAdminNote" (
  "id" TEXT NOT NULL,
  "membershipOrderId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByAdminId" TEXT NOT NULL,

  CONSTRAINT "MembershipAdminNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipBenefit_planId_code_key" ON "MembershipBenefit"("planId", "code");
CREATE INDEX "MembershipBenefit_planId_isActive_idx" ON "MembershipBenefit"("planId", "isActive");
CREATE UNIQUE INDEX "MembershipOrderBenefit_membershipOrderId_code_key" ON "MembershipOrderBenefit"("membershipOrderId", "code");
CREATE INDEX "MembershipOrderBenefit_membershipOrderId_idx" ON "MembershipOrderBenefit"("membershipOrderId");
CREATE INDEX "MembershipBenefitUse_membershipOrderId_membershipOrderBenefitId_idx" ON "MembershipBenefitUse"("membershipOrderId", "membershipOrderBenefitId");
CREATE INDEX "MembershipAdminNote_membershipOrderId_createdAt_idx" ON "MembershipAdminNote"("membershipOrderId", "createdAt");
CREATE INDEX "MembershipOrder_status_requestedAt_idx" ON "MembershipOrder"("status", "requestedAt");
CREATE INDEX "MembershipOrder_planId_status_idx" ON "MembershipOrder"("planId", "status");

ALTER TABLE "MembershipOrder"
ADD CONSTRAINT "MembershipOrder_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipOrder"
ADD CONSTRAINT "MembershipOrder_rejectedByAdminId_fkey" FOREIGN KEY ("rejectedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipBenefit"
ADD CONSTRAINT "MembershipBenefit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipOrderBenefit"
ADD CONSTRAINT "MembershipOrderBenefit_membershipOrderId_fkey" FOREIGN KEY ("membershipOrderId") REFERENCES "MembershipOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipOrderBenefit"
ADD CONSTRAINT "MembershipOrderBenefit_planBenefitId_fkey" FOREIGN KEY ("planBenefitId") REFERENCES "MembershipBenefit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipBenefitUse"
ADD CONSTRAINT "MembershipBenefitUse_membershipOrderId_fkey" FOREIGN KEY ("membershipOrderId") REFERENCES "MembershipOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipBenefitUse"
ADD CONSTRAINT "MembershipBenefitUse_membershipOrderBenefitId_fkey" FOREIGN KEY ("membershipOrderBenefitId") REFERENCES "MembershipOrderBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipBenefitUse"
ADD CONSTRAINT "MembershipBenefitUse_usedByAdminId_fkey" FOREIGN KEY ("usedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipAdminNote"
ADD CONSTRAINT "MembershipAdminNote_membershipOrderId_fkey" FOREIGN KEY ("membershipOrderId") REFERENCES "MembershipOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipAdminNote"
ADD CONSTRAINT "MembershipAdminNote_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "MembershipBenefit" (
  "id",
  "planId",
  "code",
  "titleEn",
  "titleAr",
  "descriptionEn",
  "descriptionAr",
  "limitCount",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  mps."planId",
  CONCAT('service_', mps."serviceId"),
  s."nameEn",
  s."nameAr",
  s."descriptionEn",
  s."descriptionAr",
  mps."totalUses",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MembershipPlanService" mps
INNER JOIN "Service" s ON s."id" = mps."serviceId"
ON CONFLICT ("planId", "code") DO NOTHING;

INSERT INTO "MembershipOrderBenefit" (
  "id",
  "membershipOrderId",
  "planBenefitId",
  "code",
  "titleEn",
  "titleAr",
  "descriptionEn",
  "descriptionAr",
  "limitCount",
  "isActive",
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  mo."id",
  mb."id",
  mb."code",
  mb."titleEn",
  mb."titleAr",
  mb."descriptionEn",
  mb."descriptionAr",
  mb."limitCount",
  mb."isActive",
  CURRENT_TIMESTAMP
FROM "MembershipOrder" mo
INNER JOIN "MembershipBenefit" mb ON mb."planId" = mo."planId" AND mb."isActive" = true
WHERE mo."status" = 'ACTIVE'
AND NOT EXISTS (
  SELECT 1
  FROM "MembershipOrderBenefit" mob
  WHERE mob."membershipOrderId" = mo."id"
);
