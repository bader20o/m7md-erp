-- Accounting integrity hardening:
-- - immutable snapshot/profit fields on Transaction
-- - audit + soft-delete fields on Transaction
-- - request idempotency persistence table

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "sellPriceAtTimeOfSale" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "costAtTimeOfSale" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "costTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "profitAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Transaction_updatedById_fkey'
  ) THEN
    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Transaction_deletedById_fkey'
  ) THEN
    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_deletedById_fkey"
      FOREIGN KEY ("deletedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Transaction_deletedAt_idx" ON "Transaction"("deletedAt");

UPDATE "Transaction"
SET
  "sellPriceAtTimeOfSale" = "amount",
  "costTotal" = 0,
  "profitAmount" = "amount"
WHERE "type" = 'INCOME';

UPDATE "Transaction"
SET
  "costAtTimeOfSale" = "unitPrice",
  "costTotal" = "amount",
  "profitAmount" = -("amount")
WHERE "type" = 'EXPENSE';

UPDATE "Transaction"
SET "updatedById" = "createdById"
WHERE "updatedById" IS NULL
  AND "createdById" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "RequestIdempotency" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseJson" JSONB NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequestIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RequestIdempotency_key_key" ON "RequestIdempotency"("key");
CREATE INDEX IF NOT EXISTS "RequestIdempotency_actorId_endpoint_idx" ON "RequestIdempotency"("actorId", "endpoint");
CREATE INDEX IF NOT EXISTS "RequestIdempotency_expiresAt_idx" ON "RequestIdempotency"("expiresAt");
