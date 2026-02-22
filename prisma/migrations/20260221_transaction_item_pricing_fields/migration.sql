-- Add line-item pricing fields to Transaction ledger entries
ALTER TABLE "Transaction"
ADD COLUMN "itemName" TEXT NOT NULL DEFAULT 'Unknown Item',
ADD COLUMN "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "note" TEXT;