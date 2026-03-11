ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'INVENTORY_PURCHASE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'INVENTORY_ADJUSTMENT';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryPricingMode') THEN
        CREATE TYPE "InventoryPricingMode" AS ENUM ('UNIT', 'TOTAL');
    END IF;
END $$;

ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "stockMovementId" TEXT,
ADD COLUMN IF NOT EXISTS "partIdSnapshot" TEXT,
ADD COLUMN IF NOT EXISTS "movementQuantity" INTEGER,
ADD COLUMN IF NOT EXISTS "movementUnitCost" DECIMAL(12, 3),
ADD COLUMN IF NOT EXISTS "movementTotalCost" DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS "supplierNameSnapshot" TEXT;

ALTER TABLE "StockMovement"
ADD COLUMN IF NOT EXISTS "pricingMode" "InventoryPricingMode",
ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(12, 3),
ADD COLUMN IF NOT EXISTS "totalCost" DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS "supplierNameSnapshot" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_stockMovementId_key" ON "Transaction"("stockMovementId");
