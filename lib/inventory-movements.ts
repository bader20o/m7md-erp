import {
  ExpenseCategory,
  InventoryPricingMode,
  Prisma,
  StockMovementType,
  TransactionType
} from "@prisma/client";
import { ApiError } from "@/lib/api";

type PricingInput = {
  quantity: number;
  pricingMode: InventoryPricingMode;
  unitCost?: number | null;
  totalCost?: number | null;
};

type CreateMovementInput = {
  partId: string;
  type: StockMovementType;
  pricingMode: InventoryPricingMode;
  quantity: number;
  unitCost: number;
  totalCost: number;
  occurredAt: Date;
  note: string;
  createdById: string;
  supplierId?: string | null;
  supplierNameSnapshot?: string | null;
  invoiceId?: string | null;
  bookingId?: string | null;
};

type LedgerInput = {
  movementId: string;
  partId: string;
  partName: string;
  type: StockMovementType;
  quantity: number;
  unitCost: number;
  totalCost: number;
  occurredAt: Date;
  note: string;
  createdById: string;
  supplierNameSnapshot?: string | null;
};

type TransactionClient = Prisma.TransactionClient;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function roundUnitCost(value: number): number {
  return round(value, 3);
}

export function roundTotalCost(value: number): number {
  return round(value, 2);
}

export function resolveMovementPricing(input: PricingInput): {
  pricingMode: InventoryPricingMode;
  unitCost: number;
  totalCost: number;
} {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new ApiError(400, "INVALID_MOVEMENT_QTY", "Quantity must be a whole number greater than zero.");
  }

  if (input.pricingMode === InventoryPricingMode.UNIT) {
    if (!Number.isFinite(input.unitCost) || Number(input.unitCost) <= 0) {
      throw new ApiError(400, "INVALID_UNIT_COST", "unitCost must be greater than zero.");
    }

    const unitCost = roundUnitCost(Number(input.unitCost));
    const totalCost = roundTotalCost(unitCost * input.quantity);
    return { pricingMode: input.pricingMode, unitCost, totalCost };
  }

  if (!Number.isFinite(input.totalCost) || Number(input.totalCost) <= 0) {
    throw new ApiError(400, "INVALID_TOTAL_COST", "totalCost must be greater than zero.");
  }

  const totalCost = roundTotalCost(Number(input.totalCost));
  const unitCost = roundUnitCost(totalCost / input.quantity);
  return { pricingMode: input.pricingMode, unitCost, totalCost };
}

export function getInventoryExpenseCategory(type: StockMovementType): ExpenseCategory | null {
  if (type === StockMovementType.IN) {
    return ExpenseCategory.INVENTORY_PURCHASE;
  }
  if (type === StockMovementType.OUT || type === StockMovementType.ADJUST) {
    return ExpenseCategory.INVENTORY_ADJUSTMENT;
  }
  return null;
}

export async function createInventoryMovement(
  tx: TransactionClient,
  input: CreateMovementInput
) {
  return tx.stockMovement.create({
    data: {
      partId: input.partId,
      type: input.type,
      pricingMode: input.pricingMode,
      quantity: input.quantity,
      unitCost: input.unitCost,
      totalCost: input.totalCost,
      occurredAt: input.occurredAt,
      note: input.note,
      createdById: input.createdById,
      bookingId: input.bookingId ?? null,
      supplierId: input.supplierId ?? null,
      supplierNameSnapshot: input.supplierNameSnapshot ?? null,
      invoiceId: input.invoiceId ?? null
    }
  });
}

export async function createLedgerEntryFromMovement(
  tx: TransactionClient,
  input: LedgerInput
) {
  const expenseCategory = getInventoryExpenseCategory(input.type);
  if (!expenseCategory) {
    return null;
  }

  return tx.transaction.create({
    data: {
      type: TransactionType.EXPENSE,
      itemName: input.partName,
      unitPrice: input.unitCost,
      quantity: input.quantity,
      amount: -input.totalCost,
      costAtTimeOfSale: input.unitCost,
      costTotal: input.totalCost,
      profitAmount: -input.totalCost,
      note: input.note,
      description: input.note,
      expenseCategory,
      referenceType: "INVENTORY_MOVEMENT",
      referenceId: input.movementId,
      stockMovementId: input.movementId,
      partIdSnapshot: input.partId,
      movementQuantity: input.quantity,
      movementUnitCost: input.unitCost,
      movementTotalCost: input.totalCost,
      supplierNameSnapshot: input.supplierNameSnapshot ?? null,
      occurredAt: input.occurredAt,
      recordedAt: input.occurredAt,
      createdById: input.createdById,
      updatedById: input.createdById
    }
  });
}
