import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");

    const items = await prisma.attendance.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: { employee: { include: { user: true } } },
      orderBy: { checkInAt: "desc" },
      take: 300
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}


