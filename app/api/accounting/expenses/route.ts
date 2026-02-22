import { Role, StockMovementType, TransactionType } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createExpenseSchema } from "@/lib/validators/accounting";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ACCOUNTANT, Role.MANAGER, Role.ADMIN]);

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
  try {
    const actor = requireRoles(await getSession(), [Role.ACCOUNTANT, Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, createExpenseSchema);
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
    if (!supplierId && body.supplierName) {
      const supplier = await prisma.supplier.create({
        data: { name: body.supplierName }
      });
      supplierId = supplier.id;
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

    const itemName = part?.name ?? body.itemName;

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
          note: body.note,
          description: body.note || itemName,
          expenseId: expense.id,
          expenseCategory: body.expenseCategory,
          occurredAt,
          recordedAt: occurredAt,
          createdById: actor.sub
        }
      });

      if (part && isSupplierExpense) {
        await tx.part.update({
          where: { id: part.id },
          data: { stockQty: { increment: quantity } }
        });

        await tx.stockMovement.create({
          data: {
            partId: part.id,
            type: StockMovementType.IN,
            quantity,
            occurredAt,
            note: body.note || `Purchased via expense ${expense.id}`,
            createdById: actor.sub,
            supplierId,
            invoiceId: body.invoiceId
          }
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

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}
