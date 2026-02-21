import { Role, TransactionType } from "@prisma/client";
import { fail, ok, parseJsonBody } from "@/lib/api";
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

    let supplierId = body.supplierId;
    if (!supplierId && body.supplierName) {
      const supplier = await prisma.supplier.create({
        data: { name: body.supplierName }
      });
      supplierId = supplier.id;
    }

    const item = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          amount: body.amount,
          note: body.note,
          supplierId,
          invoiceId: body.invoiceId,
          createdById: actor.sub,
          expenseDate: body.expenseDate ?? new Date()
        }
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.EXPENSE,
          amount: body.amount,
          description: body.note ?? "Expense entry",
          expenseId: expense.id,
          createdById: actor.sub
        }
      });

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
