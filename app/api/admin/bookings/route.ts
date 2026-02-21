import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.RECEPTION, Role.MANAGER, Role.ADMIN]);

    const items = await prisma.booking.findMany({
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        service: true,
        performedByEmployee: { include: { user: true } },
        assignments: { include: { employee: { include: { user: true } }, service: true } }
      },
      orderBy: { appointmentAt: "desc" },
      take: 300
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}
