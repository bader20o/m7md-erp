import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const listUsersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  take: z.coerce.number().int().min(1).max(50).default(20),
  role: z.enum(["ADMIN", "EMPLOYEE", "CUSTOMER"]).optional()
});

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const url = new URL(request.url);
    const query = await listUsersQuerySchema.parseAsync({
      q: url.searchParams.get("q") ?? undefined,
      take: url.searchParams.get("take") ?? undefined,
      role: url.searchParams.get("role") ?? undefined
    });

    const q = query.q?.trim();
    const roleFilter =
      actor.role === Role.CUSTOMER
        ? Role.ADMIN
        : actor.role === Role.ADMIN
          ? query.role ?? Role.EMPLOYEE
          : null;

    if (!roleFilter) {
      return ok({ items: [] });
    }

    const items = await prisma.user.findMany({
      where: {
        id: { not: actor.sub },
        isActive: true,
        role: roleFilter,
        ...(q
          ? {
              OR: [{ fullName: { contains: q } }, { phone: { contains: q } }]
            }
          : {})
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true
      },
      orderBy: [{ fullName: "asc" }, { phone: "asc" }],
      take: query.take
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}
