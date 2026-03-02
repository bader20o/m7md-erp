import { Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { assertCanAccessConversation } from "@/lib/chat";
import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Params): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const { id } = await context.params;

    const target = await prisma.conversationMessage.findUnique({
      where: { id },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        deletedAt: true
      }
    });

    if (!target) {
      throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    }

    await assertCanAccessConversation(prisma, target.conversationId, actor);

    if (actor.role !== Role.ADMIN && actor.sub !== target.senderId) {
      throw new ApiError(403, "FORBIDDEN", "Only sender or admin can delete this message.");
    }

    if (!target.deletedAt) {
      await prisma.conversationMessage.update({
        where: { id: target.id },
        data: {
          deletedAt: new Date(),
          deletedBy: actor.sub,
          content: ""
        }
      });
    }

    const recipients = await prisma.conversationParticipant.findMany({
      where: { conversationId: target.conversationId },
      select: { userId: true }
    });
    publishChatEvent(
      "message:deleted",
      recipients.map((item) => item.userId),
      { conversationId: target.conversationId, messageId: target.id, deletedBy: actor.sub }
    );

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
