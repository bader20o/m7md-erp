import { Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Params): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const { id } = await context.params;

    const target = await prisma.chatMessage.findUnique({
      where: { id },
      select: {
        id: true,
        threadId: true,
        senderId: true,
        createdAt: true,
        deletedAt: true
      }
    });

    if (!target) {
      throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
    }

    if (target.deletedAt) {
      return ok({ deleted: true });
    }

    const participant = await prisma.chatParticipant.findUnique({
      where: {
        threadId_userId: {
          threadId: target.threadId,
          userId: actor.sub
        }
      },
      select: { id: true }
    });

    if (!participant) {
      throw new ApiError(403, "FORBIDDEN", "Not a participant in this thread.");
    }

    if (actor.role !== Role.ADMIN && actor.sub !== target.senderId) {
      throw new ApiError(403, "FORBIDDEN", "Only sender or admin can delete this message.");
    }

    const receiverReply = await prisma.chatMessage.findFirst({
      where: {
        threadId: target.threadId,
        createdAt: { gt: target.createdAt },
        senderId: { not: target.senderId },
        deletedAt: null
      },
      select: { id: true }
    });

    if (receiverReply) {
      throw new ApiError(409, "MESSAGE_DELETE_BLOCKED", "Cannot delete message after receiver replied.");
    }

    await prisma.chatMessage.update({
      where: { id: target.id },
      data: {
        deletedAt: new Date(),
        deletedById: actor.sub,
        body: ""
      }
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}

