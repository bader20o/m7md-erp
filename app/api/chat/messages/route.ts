import { ConversationMessageType, ConversationType, Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  assertCanAccessConversation,
  ensureSupportConversationForCustomer,
  normalizeUrl,
  sanitizeMessageContent
} from "@/lib/chat";
import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const listMessagesQuerySchema = z.object({
  conversationId: z.string().min(1),
  take: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional()
});

const sendMessageSchema = z.object({
  conversationId: z.string().min(1).optional(),
  threadId: z.string().min(1).optional(),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "LINK"]).default("TEXT"),
  messageType: z.enum(["TEXT", "IMAGE", "VIDEO", "VOICE", "LINK"]).optional(),
  content: z.string().max(2000).optional(),
  body: z.string().max(2000).optional(),
  fileUrl: z.string().max(1200).optional(),
  mediaUrl: z.string().max(1200).optional()
});

const markReadSchema = z.object({
  conversationId: z.string().min(1)
});

async function resolveBroadcastUserIds(
  conversationId: string,
  conversationType: ConversationType
): Promise<string[]> {
  const participantRows = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true }
  });

  if (conversationType === ConversationType.CENTER) {
    return participantRows.map((item) => item.userId);
  }

  const adminRows = await prisma.user.findMany({
    where: { role: Role.ADMIN, isActive: true },
    select: { id: true }
  });

  return Array.from(new Set([...participantRows.map((item) => item.userId), ...adminRows.map((item) => item.id)]));
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const url = new URL(request.url);
    const query = await listMessagesQuerySchema.parseAsync({
      conversationId: url.searchParams.get("conversationId") ?? url.searchParams.get("threadId") ?? undefined,
      take: url.searchParams.get("take") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined
    });

    await assertCanAccessConversation(prisma, query.conversationId, actor);

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

    if (query.cursor) {
      const cursorMessage = await prisma.conversationMessage.findUnique({
        where: { id: query.cursor },
        select: { id: true, conversationId: true, createdAt: true }
      });

      if (!cursorMessage || cursorMessage.conversationId !== query.conversationId) {
        throw new ApiError(400, "INVALID_CURSOR", "cursor must be a valid message id from the selected conversation.");
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

    const rows = await prisma.conversationMessage.findMany({
      where: {
        conversationId: query.conversationId,
        ...cursorFilter
      },
      include: {
        sender: {
          select: { id: true, fullName: true, phone: true, role: true }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.take + 1
    });

    const hasMore = rows.length > query.take;
    const slice = hasMore ? rows.slice(0, query.take) : rows;
    const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;

    return ok({ messages: slice.reverse(), nextCursor });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const body = await parseJsonBody(request, sendMessageSchema);

    const item = await prisma.$transaction(async (tx) => {
      const resolvedType = (body.messageType ?? body.type) as "TEXT" | "IMAGE" | "VIDEO" | "VOICE" | "LINK";
      let conversationId = body.conversationId ?? body.threadId ?? null;
      const contentInput = body.content ?? body.body ?? "";
      const fileUrlInput = body.fileUrl ?? body.mediaUrl;

      if (!conversationId) {
        if (actor.role !== Role.CUSTOMER) {
          throw new ApiError(400, "CONVERSATION_REQUIRED", "conversationId is required.");
        }

        const conversation = await ensureSupportConversationForCustomer(tx, actor.sub);
        conversationId = conversation.id;
      }

      const conversation = await assertCanAccessConversation(tx, conversationId, actor);
      const content = sanitizeMessageContent(contentInput);
      const maybeUrl = normalizeUrl(content);

      const type = resolvedType as ConversationMessageType;
      if (type === ConversationMessageType.TEXT && !content) {
        throw new ApiError(400, "MESSAGE_CONTENT_REQUIRED", "Text message content is required.");
      }

      if (type === ConversationMessageType.LINK && !maybeUrl) {
        throw new ApiError(400, "INVALID_LINK", "A valid http/https link is required.");
      }

      if (
        (type === ConversationMessageType.IMAGE ||
          type === ConversationMessageType.VIDEO ||
          type === ConversationMessageType.VOICE) &&
        !fileUrlInput?.trim()
      ) {
        throw new ApiError(400, "FILE_REQUIRED", "fileUrl is required for media messages.");
      }
      if (
        (type === ConversationMessageType.IMAGE ||
          type === ConversationMessageType.VIDEO ||
          type === ConversationMessageType.VOICE) &&
        fileUrlInput &&
        !fileUrlInput.startsWith("/uploads/")
      ) {
        throw new ApiError(400, "INVALID_FILE_URL", "Invalid uploaded file URL.");
      }

      const message = await tx.conversationMessage.create({
        data: {
          conversationId,
          senderId: actor.sub,
          content: type === ConversationMessageType.LINK ? maybeUrl ?? content : content,
          type,
          fileUrl: fileUrlInput?.trim() || null
        },
        include: {
          sender: { select: { id: true, fullName: true, phone: true, role: true } }
        }
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      return { message, conversation };
    });

    const toUserIds = await resolveBroadcastUserIds(item.message.conversationId, item.conversation.type);
    publishChatEvent("message:new", toUserIds, {
      conversationId: item.message.conversationId,
      message: item.message
    });

    return ok({ item: item.message }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const body = await parseJsonBody(request, markReadSchema);

    const conversation = await assertCanAccessConversation(prisma, body.conversationId, actor);

    await prisma.conversationParticipant.upsert({
      where: {
        conversationId_userId: {
          conversationId: body.conversationId,
          userId: actor.sub
        }
      },
      update: { lastReadAt: new Date() },
      create: {
        conversationId: body.conversationId,
        userId: actor.sub,
        lastReadAt: new Date()
      }
    });

    const toUserIds = await resolveBroadcastUserIds(body.conversationId, conversation.type);
    publishChatEvent("conversation:read", toUserIds, {
      conversationId: body.conversationId,
      userId: actor.sub,
      readAt: new Date().toISOString()
    });

    return ok({ read: true });
  } catch (error) {
    return fail(error);
  }
}
