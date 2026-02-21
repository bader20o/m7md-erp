import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Params): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const { id } = await context.params;

    const item = await prisma.notification.updateMany({
      where: {
        id,
        userId: actor.sub
      },
      data: {
        isSeen: true,
        seenAt: new Date()
      }
    });

    return ok({ updated: item.count });
  } catch (error) {
    return fail(error);
  }
}

