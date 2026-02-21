import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const sendMessageSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1).max(3000)
});

const markSeenSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1)
});

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const url = new URL(request.url);
    const threadId = url.searchParams.get("threadId");
    if (!threadId) {
      throw new ApiError(400, "MISSING_THREAD_ID", "threadId is required.");
    }

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

    const items = await prisma.chatMessage.findMany({
      where: { threadId },
      include: {
        sender: { select: { id: true, fullName: true, phone: true } },
        seenBy: true
      },
      orderBy: { createdAt: "asc" },
      take: 300
    });

    return ok({ items });
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

    const item = await prisma.chatMessage.create({
      data: {
        threadId: body.threadId,
        senderId: actor.sub,
        body: body.body
      }
    });

    await prisma.chatThread.update({
      where: { id: body.threadId },
      data: { updatedAt: new Date() }
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
        threadId: { in: threadIds }
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

    await prisma.chatParticipant.updateMany({
      where: {
        userId: actor.sub,
        threadId: { in: Array.from(allowedThreadIds) }
      },
      data: { lastSeenAt: new Date() }
    });

    return ok({ inserted: inserted.count });
  } catch (error) {
    return fail(error);
  }
}

