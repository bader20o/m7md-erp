import { Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const listMessagesQuerySchema = z.object({
  threadId: z.string().min(1),
  take: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional()
});

const sendMessageSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1).max(2000)
});

const markSeenSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1)
});

async function assertAdminContactThread(threadId: string, actorRole: Role): Promise<void> {
  if (actorRole === Role.ADMIN) {
    return;
  }

  const adminParticipantsCount = await prisma.chatParticipant.count({
    where: {
      threadId,
      user: { role: Role.ADMIN }
    }
  });

  if (adminParticipantsCount === 0) {
    throw new ApiError(403, "FORBIDDEN", "You can only access conversations with center admins.");
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const url = new URL(request.url);
    const query = await listMessagesQuerySchema.parseAsync({
      threadId: url.searchParams.get("threadId") ?? undefined,
      take: url.searchParams.get("take") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined
    });
    const { threadId, take, cursor } = query;

    const participant = await prisma.chatParticipant.findUnique({
      where: {
        threadId_userId: {
          threadId,
          userId: actor.sub
        }
      },
      select: { id: true }
    });
    if (!participant) {
      throw new ApiError(403, "FORBIDDEN", "Not a participant in this thread.");
    }
    await assertAdminContactThread(threadId, actor.role);

    let cursorFilter:
      | {
          OR: Array<
            | { createdAt: { lt: Date } }
            | {
                createdAt: Date;
                id: { lt: string };
              }
          >;
        }
      | undefined;

    if (cursor) {
      const cursorMessage = await prisma.chatMessage.findUnique({
        where: { id: cursor },
        select: { id: true, threadId: true, createdAt: true }
      });

      if (!cursorMessage || cursorMessage.threadId !== threadId) {
        throw new ApiError(400, "INVALID_CURSOR", "cursor must be a valid message id from the selected thread.");
      }

      cursorFilter = {
        OR: [
          { createdAt: { lt: cursorMessage.createdAt } },
          {
            createdAt: cursorMessage.createdAt,
            id: { lt: cursorMessage.id }
          }
        ]
      };
    }

    const rows = await prisma.chatMessage.findMany({
      where: {
        threadId,
        ...cursorFilter
      },
      include: {
        sender: { select: { id: true, fullName: true, phone: true, role: true } },
        seenBy: {
          where: { userId: actor.sub },
          select: { id: true, userId: true, messageId: true, seenAt: true }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1
    });

    const hasMore = rows.length > take;
    const slice = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
    const messages = slice.reverse();

    return ok({ messages, nextCursor });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const body = await parseJsonBody(request, sendMessageSchema);

    const participant = await prisma.chatParticipant.findUnique({
      where: {
        threadId_userId: {
          threadId: body.threadId,
          userId: actor.sub
        }
      }
    });
    if (!participant) {
      throw new ApiError(403, "FORBIDDEN", "Not a participant in this thread.");
    }
    await assertAdminContactThread(body.threadId, actor.role);

    const item = await prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          threadId: body.threadId,
          senderId: actor.sub,
          body: body.body
        }
      });

      await tx.chatThread.update({
        where: { id: body.threadId },
        data: { updatedAt: new Date() }
      });

      return message;
    });

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const body = await parseJsonBody(request, markSeenSchema);

    const messages = await prisma.chatMessage.findMany({
      where: { id: { in: body.messageIds } },
      select: { id: true, threadId: true }
    });

    if (!messages.length) {
      return ok({ inserted: 0 });
    }

    const threadIds = Array.from(new Set(messages.map((message) => message.threadId)));
    const participantRows = await prisma.chatParticipant.findMany({
      where: {
        userId: actor.sub,
        threadId: { in: threadIds },
        ...(actor.role === Role.ADMIN
          ? {}
          : {
              thread: {
                participants: {
                  some: {
                    user: { role: Role.ADMIN }
                  }
                }
              }
            })
      },
      select: { threadId: true }
    });
    const allowedThreadIds = new Set(participantRows.map((item) => item.threadId));

    const allowedMessageIds = messages
      .filter((message) => allowedThreadIds.has(message.threadId))
      .map((message) => message.id);

    if (!allowedMessageIds.length) {
      return ok({ inserted: 0 });
    }

    const inserted = await prisma.chatMessageSeen.createMany({
      data: allowedMessageIds.map((messageId) => ({
        messageId,
        userId: actor.sub
      })),
      skipDuplicates: true
    });

    const allowedMessageIdSet = new Set(allowedMessageIds);
    const seenThreadIds = Array.from(
      new Set(
        messages
          .filter((message) => allowedMessageIdSet.has(message.id))
          .map((message) => message.threadId)
      )
    );

    await prisma.chatParticipant.updateMany({
      where: {
        userId: actor.sub,
        threadId: { in: seenThreadIds }
      },
      data: { lastSeenAt: new Date() }
    });

    return ok({ inserted: inserted.count });
  } catch (error) {
    return fail(error);
  }
}
