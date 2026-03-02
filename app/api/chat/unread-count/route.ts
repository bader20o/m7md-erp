import { ConversationType, Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    const actor = requireSession(await getSession());

    const participants = await prisma.conversationParticipant.findMany({
      where: {
        userId: actor.sub,
        conversation: {
          ...(actor.role === Role.CUSTOMER ? { type: ConversationType.SUPPORT } : {}),
          ...(actor.role === Role.EMPLOYEE ? { type: ConversationType.CENTER } : {})
        }
      },
      select: { conversationId: true, lastReadAt: true }
    });

    const conversationUnread = await Promise.all(
      participants.map(async (participant) => {
        const unreadCount = await prisma.conversationMessage.count({
          where: {
            conversationId: participant.conversationId,
            senderId: { not: actor.sub },
            deletedAt: null,
            ...(participant.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {})
          }
        });
        return unreadCount > 0 ? 1 : 0;
      })
    );

    return ok({ unreadCount: conversationUnread.reduce<number>((sum, value) => sum + value, 0) });
  } catch (error) {
    return fail(error);
  }
}
