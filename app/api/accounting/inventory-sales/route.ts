import {
  IncomeSource,
  InventoryPricingMode,
  Role,
  StockMovementType,
  TransactionType
} from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createInventoryMovement } from "@/lib/inventory-movements";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { inventorySaleSchema } from "@/lib/validators/accounting";

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, inventorySaleSchema);
    const occurredAt = body.occurredAt ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      const part = await tx.part.findUnique({
        where: { id: body.itemId },
        select: {
          id: true,
          name: true,
          vehicleModel: true,
          vehicleType: true,
          costPrice: true,
          sellPrice: true,
          stockQty: true,
          isActive: true
        }
      });

      if (!part) {
        throw new ApiError(404, "PART_NOT_FOUND", "Inventory item not found.");
      }
      if (!part.isActive) {
        throw new ApiError(400, "PART_INACTIVE", "Inactive inventory item cannot be sold.");
      }
      if (part.stockQty < body.quantity) {
        throw new ApiError(
          400,
          "INSUFFICIENT_STOCK",
          `Insufficient stock: available ${part.stockQty}, requested ${body.quantity}.`
        );
      }

      const unitPrice = body.unitPrice ?? part.sellPrice ?? 0;
      const amount = Number((unitPrice * body.quantity).toFixed(2));
      const updated = await tx.part.updateMany({
        where: { id: part.id, stockQty: { gte: body.quantity } },
        data: { stockQty: { decrement: body.quantity } }
      });
      if (updated.count === 0) {
        throw new ApiError(400, "INSUFFICIENT_STOCK", "Stock changed. Please retry.");
      }

      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.INCOME,
          incomeSource: IncomeSource.INVENTORY_SALE,
          itemName: part.name,
          unitPrice,
          quantity: body.quantity,
          amount,
          sellPriceAtTimeOfSale: unitPrice,
          costAtTimeOfSale: part.costPrice ?? 0,
          costTotal: Number(((part.costPrice ?? 0) * body.quantity).toFixed(2)),
          profitAmount: Number((amount - ((part.costPrice ?? 0) * body.quantity)).toFixed(2)),
          note: body.note,
          description: body.note || `Sold from inventory: ${part.name}`,
          referenceType: "INVENTORY_SALE",
          referenceId: part.id,
          occurredAt,
          recordedAt: occurredAt,
          createdById: actor.sub,
          updatedById: actor.sub
        }
      });

      const movement = await createInventoryMovement(tx, {
        partId: part.id,
        type: StockMovementType.SALE,
        pricingMode: InventoryPricingMode.UNIT,
        quantity: body.quantity,
        unitCost: unitPrice,
        totalCost: amount,
        occurredAt,
        note: body.note || "Sold via accounting",
        createdById: actor.sub
      });

      return { part, transaction, movement };
    });

    await logAudit({
      action: "INVENTORY_SALE_CREATE",
      entity: "Transaction",
      entityId: result.transaction.id,
      actorId: actor.sub,
      payload: {
        partId: result.part.id,
        partName: result.part.name,
        quantity: result.transaction.quantity,
        unitPrice: result.transaction.unitPrice,
        amount: result.transaction.amount,
        stockMovementId: result.movement.id
      }
    });

    return ok(
      {
        transaction: result.transaction,
        movement: result.movement
      },
      201
    );
  } catch (error) {
    return fail(error);
  }
}
