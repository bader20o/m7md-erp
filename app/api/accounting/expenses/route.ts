import { InventoryPricingMode, Role, StockMovementType, TransactionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  beginIdempotency,
  finalizeIdempotencyFailure,
  finalizeIdempotencySuccess
} from "@/lib/idempotency";
import { createInventoryMovement } from "@/lib/inventory-movements";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createExpenseSchema } from "@/lib/validators/accounting";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);

    const items = await prisma.expense.findMany({
      include: { supplier: true, invoice: true, transaction: true },
      orderBy: { expenseDate: "desc" },
      take: 200
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  let idempotencyState: Awaited<ReturnType<typeof beginIdempotency>>["state"] = null;
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, createExpenseSchema);
    const idempotency = await beginIdempotency({
      request,
      actorId: actor.sub,
      payload: body
    });
    idempotencyState = idempotency.state;
    if (idempotency.replayResponse) {
      return idempotency.replayResponse;
    }

    const occurredAt = body.occurredAt;
    const unitPrice = body.unitPrice;
    const quantity = body.quantity;
    const amount = Number((unitPrice * quantity).toFixed(2));
    const isSupplierExpense = body.expenseCategory === "SUPPLIER";

    if (body.partId && !isSupplierExpense) {
      throw new ApiError(
        400,
        "PART_PURCHASE_REQUIRES_SUPPLIER_CATEGORY",
        "partId is only supported for SUPPLIER expenses."
      );
    }

    let supplierId = body.supplierId;
    let supplierNameSnapshot = body.supplierName?.trim() || null;
    if (!supplierId && body.supplierName) {
      const supplier = await prisma.supplier.create({
        data: { name: body.supplierName }
      });
      supplierId = supplier.id;
      supplierNameSnapshot = supplier.name;
    } else if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { name: true }
      });
      supplierNameSnapshot = supplier?.name ?? supplierNameSnapshot;
    }

    const part = body.partId
      ? await prisma.part.findUnique({
        where: { id: body.partId },
        select: { id: true, name: true, isActive: true }
      })
      : null;

    if (body.partId && !part) {
      throw new ApiError(404, "PART_NOT_FOUND", "Part not found.");
    }
    if (part && !part.isActive) {
      throw new ApiError(400, "PART_INACTIVE", "Part is inactive.");
    }

    const itemName = part?.name ?? body.itemName.trim();
    if (part && body.itemName.trim().toLowerCase() !== part.name.trim().toLowerCase()) {
      throw new ApiError(
        400,
        "ITEM_NAME_MISMATCH",
        "Selected catalog item name does not match the provided item name."
      );
    }

    const item = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          amount,
          note: body.note || itemName,
          expenseCategory: body.expenseCategory,
          supplierId,
          invoiceId: body.invoiceId,
          createdById: actor.sub,
          expenseDate: occurredAt
        }
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.EXPENSE,
          itemName,
          unitPrice,
          quantity,
          amount,
          costAtTimeOfSale: unitPrice,
          costTotal: amount,
          profitAmount: -amount,
          note: body.note,
          description: body.note || itemName,
          expenseId: expense.id,
          expenseCategory: body.expenseCategory,
          occurredAt,
          recordedAt: occurredAt,
          createdById: actor.sub,
          updatedById: actor.sub
        }
      });

      if (part && isSupplierExpense) {
        await tx.part.update({
          where: { id: part.id },
          data: { stockQty: { increment: quantity } }
        });

        await createInventoryMovement(tx, {
          partId: part.id,
          type: StockMovementType.IN,
          pricingMode: InventoryPricingMode.UNIT,
          quantity,
          unitCost: unitPrice,
          totalCost: amount,
          occurredAt,
          note: body.note || `Purchased via expense ${expense.id}`,
          createdById: actor.sub,
          supplierId,
          supplierNameSnapshot,
          invoiceId: body.invoiceId
        });
      }

      return expense;
    });

    await logAudit({
      action: "EXPENSE_CREATE",
      entity: "Expense",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        amount: item.amount,
        supplierId: item.supplierId,
        invoiceId: item.invoiceId
      }
    });

    const responsePayload = { success: true, data: { item } };
    await finalizeIdempotencySuccess(idempotencyState, responsePayload, 201);
    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    await finalizeIdempotencyFailure(idempotencyState, error);
    return fail(error);
  }
}

