import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const items = await prisma.auditLog.findMany({
      include: { actor: { select: { id: true, fullName: true, phone: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}


