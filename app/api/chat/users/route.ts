import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const listUsersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  take: z.coerce.number().int().min(1).max(50).default(20)
});

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const url = new URL(request.url);
    const query = await listUsersQuerySchema.parseAsync({
      q: url.searchParams.get("q") ?? undefined,
      take: url.searchParams.get("take") ?? undefined
    });

    const q = query.q?.trim();
    const restrictToAdmins = actor.role !== Role.ADMIN;

    const items = await prisma.user.findMany({
      where: {
        id: { not: actor.sub },
        isActive: true,
        ...(restrictToAdmins ? { role: Role.ADMIN } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } }
              ]
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
