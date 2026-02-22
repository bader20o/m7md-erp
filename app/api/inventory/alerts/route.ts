import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);

    const parts = await prisma.part.findMany({
      where: { isActive: true },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }]
    });

    const items = parts
      .filter((part) => isLowStock(part.stockQty, part.lowStockThreshold))
      .map((part) => ({
        ...part,
        lowStock: true
      }));

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}
