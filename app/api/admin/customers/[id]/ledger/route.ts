import { CustomerAccountEntryType, Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";

const createLedgerEntrySchema = z.object({
  type: z.enum(["CHARGE", "PAYMENT", "ADJUSTMENT"]),
  amount: z.coerce.number(),
  occurredAt: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
  referenceType: z.string().max(80).optional(),
  referenceId: z.string().max(100).optional()
});

type Params = { params: Promise<{ id: string }> };

function computeBalanceDue(entries: Array<{ type: CustomerAccountEntryType; amount: unknown }>): number {
  return Number(
    entries
      .reduce((sum, entry) => {
        const amount = Number(entry.amount);
        return entry.type === CustomerAccountEntryType.PAYMENT ? sum - amount : sum + amount;
      }, 0)
      .toFixed(2)
  );
}

export async function GET(_: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["accounting"]);
    }

    const { id } = await context.params;
    const customer = await prisma.user.findFirst({
      where: { id, role: Role.CUSTOMER },
      select: { id: true }
    });
    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    const entries = await prisma.customerAccountEntry.findMany({
      where: { customerId: id },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: {
        createdByAdmin: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        }
      }
    });

    return ok({
      items: entries,
      balanceDue: computeBalanceDue(entries)
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, createLedgerEntrySchema);
    const { id } = await context.params;

    const customer = await prisma.user.findFirst({
      where: { id, role: Role.CUSTOMER },
      select: { id: true }
    });
    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    if ((body.type === "CHARGE" || body.type === "ADJUSTMENT") && !body.note?.trim()) {
      throw new ApiError(400, "NOTE_REQUIRED", "Note is required for CHARGE and ADJUSTMENT.");
    }

    if (body.type !== "ADJUSTMENT" && body.amount <= 0) {
      throw new ApiError(400, "INVALID_AMOUNT", "Amount must be greater than 0.");
    }

    const amount = Math.abs(body.amount);
    const persistedAmount = body.type === "ADJUSTMENT" ? body.amount : amount;

    const item = await prisma.customerAccountEntry.create({
      data: {
        customerId: id,
        type: body.type,
        amount: persistedAmount,
        occurredAt: body.occurredAt ?? new Date(),
        note: body.note?.trim() || null,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        createdByAdminId: actor.sub
      }
    });

    await logAudit({
      action: `CUSTOMER_LEDGER_${body.type}`,
      entity: "CustomerAccountEntry",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        customerId: id,
        amount: item.amount,
        type: item.type
      }
    });

    const allEntries = await prisma.customerAccountEntry.findMany({
      where: { customerId: id },
      select: { type: true, amount: true }
    });

    return ok({
      item,
      balanceDue: computeBalanceDue(allEntries)
    }, 201);
  } catch (error) {
    return fail(error);
  }
}

