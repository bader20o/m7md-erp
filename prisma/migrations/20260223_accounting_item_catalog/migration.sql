CREATE TABLE "ItemCatalog" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "defaultUnitPrice" DECIMAL(12,2) NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ItemCatalog_itemName_category_key" ON "ItemCatalog"("itemName", "category");
CREATE INDEX "ItemCatalog_itemName_idx" ON "ItemCatalog"("itemName");
