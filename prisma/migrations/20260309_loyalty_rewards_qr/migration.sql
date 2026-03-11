DO $$ BEGIN
  CREATE TYPE "RewardTriggerType" AS ENUM ('VISIT_COUNT', 'COMPLETED_BOOKING_COUNT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RewardType" AS ENUM ('FREE_SERVICE', 'DISCOUNT_PERCENTAGE', 'FIXED_AMOUNT_DISCOUNT', 'CUSTOM_GIFT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerRewardStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CheckInMethod" AS ENUM ('QR', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RewardSourceType" AS ENUM ('VISIT', 'BOOKING_COMPLETION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BookingPricingMode" AS ENUM ('NORMAL', 'MANUAL', 'REWARD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "pricingMode" "BookingPricingMode" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "rewardId" TEXT;

CREATE TABLE IF NOT EXISTS "CustomerVisit" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visitDate" TIMESTAMP(3) NOT NULL,
  "checkInMethod" "CheckInMethod" NOT NULL DEFAULT 'QR',
  "qrRotationId" TEXT,
  "branchId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RewardRule" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "triggerType" "RewardTriggerType" NOT NULL,
  "triggerValue" INTEGER NOT NULL,
  "rewardType" "RewardType" NOT NULL,
  "rewardServiceId" TEXT,
  "rewardLabel" TEXT,
  "discountPercentage" DECIMAL(5,2),
  "fixedAmount" DECIMAL(12,2),
  "customGiftText" TEXT,
  "currency" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerRewardProgress" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "rewardRuleId" TEXT NOT NULL,
  "progressValue" INTEGER NOT NULL DEFAULT 0,
  "completedCycles" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerRewardProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerReward" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "rewardRuleId" TEXT NOT NULL,
  "rewardType" "RewardType" NOT NULL,
  "rewardServiceId" TEXT,
  "rewardLabel" TEXT,
  "discountPercentage" DECIMAL(5,2),
  "fixedAmount" DECIMAL(12,2),
  "customGiftText" TEXT,
  "status" "CustomerRewardStatus" NOT NULL DEFAULT 'AVAILABLE',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redeemedAt" TIMESTAMP(3),
  "redeemedBookingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerReward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RewardEvent" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "rewardRuleId" TEXT NOT NULL,
  "sourceType" "RewardSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "progressDelta" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_rewardId_key" ON "Booking"("rewardId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerVisit_customerId_visitDate_key" ON "CustomerVisit"("customerId", "visitDate");
CREATE INDEX IF NOT EXISTS "CustomerVisit_visitDate_idx" ON "CustomerVisit"("visitDate");
CREATE UNIQUE INDEX IF NOT EXISTS "RewardRule_code_key" ON "RewardRule"("code");
CREATE INDEX IF NOT EXISTS "RewardRule_isActive_sortOrder_idx" ON "RewardRule"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "RewardRule_triggerType_isActive_idx" ON "RewardRule"("triggerType", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerRewardProgress_customerId_rewardRuleId_key" ON "CustomerRewardProgress"("customerId", "rewardRuleId");
CREATE INDEX IF NOT EXISTS "CustomerReward_customerId_status_issuedAt_idx" ON "CustomerReward"("customerId", "status", "issuedAt");
CREATE INDEX IF NOT EXISTS "CustomerReward_rewardRuleId_status_idx" ON "CustomerReward"("rewardRuleId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "RewardEvent_rewardRuleId_sourceType_sourceId_customerId_key" ON "RewardEvent"("rewardRuleId", "sourceType", "sourceId", "customerId");
CREATE INDEX IF NOT EXISTS "RewardEvent_customerId_createdAt_idx" ON "RewardEvent"("customerId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "CustomerReward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerVisit" ADD CONSTRAINT "CustomerVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_rewardServiceId_fkey" FOREIGN KEY ("rewardServiceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerRewardProgress" ADD CONSTRAINT "CustomerRewardProgress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerRewardProgress" ADD CONSTRAINT "CustomerRewardProgress_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerReward" ADD CONSTRAINT "CustomerReward_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerReward" ADD CONSTRAINT "CustomerReward_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerReward" ADD CONSTRAINT "CustomerReward_rewardServiceId_fkey" FOREIGN KEY ("rewardServiceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
