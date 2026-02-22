import { Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { requireRoles } from "@/lib/rbac";
import { createEmployeeSchema } from "@/lib/validators/employee";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);
    const items = await prisma.employee.findMany({
      include: { user: true, services: { include: { service: true } } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, createEmployeeSchema);

    const existing = await prisma.user.findUnique({ where: { phone: body.phone }, select: { id: true } });
    if (existing) {
      throw new ApiError(409, "PHONE_ALREADY_EXISTS", "Phone already exists.");
    }

    const item = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: body.phone,
          passwordHash: await hashPassword(body.password),
          fullName: body.fullName,
          role: Role.EMPLOYEE
        }
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          jobTitle: body.jobTitle,
          monthlyBase: body.monthlyBase
        },
        include: { user: true }
      });

      return employee;
    });

    await logAudit({
      action: "EMPLOYEE_CREATE",
      entity: "Employee",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        userId: item.userId,
        role: item.user.role
      }
    });

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}
