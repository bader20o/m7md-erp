import { ConversationType, Prisma, Role } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export function sanitizeMessageContent(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/<[^>]*>/g, "");
}

export function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function ensureCenterConversation(tx: Prisma.TransactionClient | typeof prisma): Promise<{ id: string }> {
  const existing = await tx.conversation.findFirst({
    where: { type: ConversationType.CENTER },
    select: { id: true }
  });
  if (existing) {
    return existing;
  }

  return tx.conversation.create({
    data: { type: ConversationType.CENTER },
    select: { id: true }
  });
}

export async function ensureParticipant(
  tx: Prisma.TransactionClient | typeof prisma,
  conversationId: string,
  userId: string
): Promise<void> {
  await tx.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId,
        userId
      }
    },
    update: {},
    create: {
      conversationId,
      userId
    }
  });
}

export async function ensureSupportConversationForCustomer(
  tx: Prisma.TransactionClient | typeof prisma,
  customerUserId: string
): Promise<{ id: string }> {
  const existing = await tx.conversation.findFirst({
    where: {
      type: ConversationType.SUPPORT,
      participants: {
        some: { userId: customerUserId }
      }
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" }
  });
  if (existing) {
    return existing;
  }

  const created = await tx.conversation.create({
    data: {
      type: ConversationType.SUPPORT,
      participants: {
        create: { userId: customerUserId }
      }
    },
    select: { id: true }
  });

  return created;
}

export async function assertCanAccessConversation(
  tx: Prisma.TransactionClient | typeof prisma,
  conversationId: string,
  actor: { sub: string; role: Role }
): Promise<{ id: string; type: ConversationType }> {
  const conversation = await tx.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, type: true }
  });

  if (!conversation) {
    throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  }

  if (conversation.type === ConversationType.SUPPORT && actor.role === Role.EMPLOYEE) {
    throw new ApiError(403, "FORBIDDEN", "Employees cannot access support chat.");
  }

  const participant = await tx.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: actor.sub
      }
    },
    select: { userId: true }
  });

  if (participant) {
    return conversation;
  }

  if (conversation.type === ConversationType.SUPPORT && actor.role === Role.ADMIN) {
    await ensureParticipant(tx, conversationId, actor.sub);
    return conversation;
  }

  throw new ApiError(403, "FORBIDDEN", "Not a participant in this conversation.");
}
