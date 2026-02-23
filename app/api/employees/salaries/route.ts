import { Role, SalaryPaymentStatus } from "@prisma/client";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { salaryPaymentSchema } from "@/lib/validators/employee";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const items = await prisma.salaryPayment.findMany({
      include: { employee: { include: { user: true } }, recordedBy: true },
      orderBy: { createdAt: "desc" },
      take: 300
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, salaryPaymentSchema);

    const item = await prisma.salaryPayment.create({
      data: {
        employeeId: body.employeeId,
        amount: body.amount,
        periodMonth: body.periodMonth,
        periodYear: body.periodYear,
        note: body.note,
        recordedById: actor.sub,
        status: body.markPaid ? SalaryPaymentStatus.PAID : SalaryPaymentStatus.PENDING,
        paidAt: body.markPaid ? new Date() : null
      }
    });

    await logAudit({
      action: "SALARY_PAYMENT_CREATE",
      entity: "SalaryPayment",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        employeeId: item.employeeId,
        amount: item.amount,
        status: item.status
      }
    });

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}

