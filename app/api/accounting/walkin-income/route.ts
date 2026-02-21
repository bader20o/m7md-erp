import { IncomeSource, Role, TransactionType } from "@prisma/client";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { walkInIncomeSchema } from "@/lib/validators/accounting";

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.RECEPTION, Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, walkInIncomeSchema);
    const occurredAt = body.occurredAt ?? new Date();

    const item = await prisma.transaction.create({
      data: {
        type: TransactionType.INCOME,
        incomeSource: IncomeSource.WALK_IN,
        amount: body.amount,
        description: body.description,
        referenceType: "WALK_IN",
        referenceId: body.branchId ?? "MAIN",
        occurredAt,
        recordedAt: occurredAt,
        createdById: actor.sub
      }
    });

    await logAudit({
      action: "LEDGER_CREATE",
      entity: "Transaction",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        type: item.type,
        income