import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.RECEPTION, Role.MANAGER, Role.ADMIN]);

    const url = new URL(request.url);
    const role = url.searchParams.get("role");

    const items = await prisma.user.findMany({
      where: role ? { role: role as Role } : undefined,
      orderBy: { createdAt: "desc" },
      take: 300
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

