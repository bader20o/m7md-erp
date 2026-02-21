import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ACCOUNTANT, Role.MANAGER, Role.ADMIN]);

    const items = await prisma.transaction.findMany({
      include: {
        booking: true,
        expense: { include: { supplier: true, invoice: true } },
        membershipOrder: true
      },
      orderBy: { recordedAt: "desc" },
      take: 300
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

