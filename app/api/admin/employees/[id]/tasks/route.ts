import { Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params): Promise<Response> {
  try {
    const session = requireRoles(await getSession(), [Role.ADMIN, Role.EMPLOYEE]);
    const { id } = await context.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, role: true }
        }
      }
    });

    if (!employee || employee.user.role !== Role.EMPLOYEE) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
    }

    if (session.role === Role.EMPLOYEE && session.sub !== employee.userId) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission for this resource.");
    }

    const tasks = await prisma.task.findMany({
      where: { assignedToId: employee.userId },
      include: {
        assignedTo: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
        createdBy: { select: { id: true, fullName: true, phone: true } }
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { updatedAt: "desc" }]
    });

    return ok({ items: tasks });
  } catch (error) {
    return fail(error);
  }
}
