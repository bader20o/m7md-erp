import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    const actor = requireSession(await getSession());

    const unreadCount = await prisma.chatMessage.count({
      where: {
        senderId: { not: actor.sub },
        seenBy: {
          none: { userId: actor.sub }
        },
        thread: {
          AND: [
            {
              participants: {
                some: { userId: actor.sub }
              }
            },
            ...(actor.role === Role.ADMIN
              ? []
              : [
                  {
                    participants: {
                      some: {
                        user: { role: Role.ADMIN }
                      }
                    }
                  }
                ])
          ]
        }
      }
    });

    return ok({ unreadCount });
  } catch (error) {
    return fail(error);
  }
}
