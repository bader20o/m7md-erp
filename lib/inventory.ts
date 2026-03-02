import type { Role, StockMovementType } from "@prisma/client";

export type AdjustDirection = "IN" | "OUT";

export function resolveStockDelta(
  type: StockMovementType,
  quantity: number,
  adjustDirection?: AdjustDirection
): number {
  if (type === "IN") {
    return quantity;
  }

  if (type === "OUT") {
    return -quantity;
  }

  if (type === "ADJUST") {
    if (!adjustDirection) {
      throw new Error("adjustDirection is required for ADJUST stock movements.");
    }
    return adjustDirection === "IN" ? quantity : -quantity;
  }

  return 0;
}

export function computeStockQty(currentQty: number, delta: number): number {
  return currentQty + delta;
}

export function canOverrideNegativeStock(_role: Role): boolean {
  return false;
}

export function isStockChangeAllowed(currentQty: number, delta: number, _role: Role): boolean {
  return computeStockQty(currentQty, delta) >= 0;
}

export function isLowStock(stockQty: number, lowStockThreshold: number): boolean {
  return stockQty <= lowStockThreshold;
}
