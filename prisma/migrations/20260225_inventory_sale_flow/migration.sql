-- Add new income source for inventory-originated accounting sales.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'INVENTORY_SALE'
      AND enumtypid = '"IncomeSource"'::regtype
  ) THEN
    ALTER TYPE "IncomeSource" ADD VALUE 'INVENTORY_SALE';
  END IF;
END $$;

-- Extend part master data to include vehicle metadata and category tags.
ALTER TABLE "Part"
  ADD COLUMN IF NOT EXISTS "vehicleModel" TEXT,
  ADD COLUMN IF NOT EXISTS "vehicleType" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT;
