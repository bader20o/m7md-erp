import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const items = await prisma.notification.findMany({
      where: { userId: actor.sub },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

