import { ConversationType, Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { ensureCenterConversation, ensureParticipant, ensureSupportConversationForCustomer } from "@/lib/chat";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const createConversationSchema = z.object({
  type: z.enum(["SUPPORT", "CENTER"]).default("SUPPORT"),
  customerUserId: z.string().min(1).optional()
});

async function buildItemsForActor(actor: { sub: string; role: Role }): Promise<unknown[]> {
  if (actor.role === Role.EMPLOYEE) {
    const center = await prisma.$transaction(async (tx) => {
      const conversation = await ensureCenterConversation(tx);
      await ensureParticipant(tx, conversation.id, actor.sub);
      return tx.conversation.findUniqueOrThrow({
        where: { id: conversation.id },
        include: {
          participants: {
            include: { user: { select: { id: true, fullName: true, phone: true, role: true, avatarUrl: true } } }
          },
          messages: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            include: { sender: { select: { id: true, fullName: true, phone: true, role: true, avatarUrl: true } } }
          }
        }
      });
    });

    const me = center.participants.find((participant) => participant.userId === actor.sub);
    const unreadCount = await prisma.conversationMessage.count({
      where: {
        conversationId: center.id,
        senderId: { not: actor.sub },
        deletedAt: null,
        ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {})
      }
    });

    return [
      {
        id: center.id,
        type: center.type,
        createdAt: center.createdAt,
        updatedAt: center.updatedAt,
        participants: center.participants,
        latestMessage: center.messages[0] ?? null,
        unreadCount
      }
    ];
  }

  if (actor.role === Role.ADMIN) {
    const centerConversation = await prisma.$transaction(async (tx) => {
      const center = await ensureCenterConversation(tx);
      await ensureParticipant(tx, center.id, actor.sub);
      return center;
    });

    const supportRows = await prisma.conversation.findMany({
      where: { type: ConversationType.SUPPORT },
      select: { id: true }
    });

    if (supportRows.length) {
      await prisma.conversationParticipant.createMany({
        data: supportRows.map((row) => ({ conversationId: row.id, userId: actor.sub })),
        skipDuplicates: true
      });
    }

    const items = await prisma.conversation.findMany({
      where: {
        id: {
          in: [...supportRows.map((row) => row.id), centerConversation.id]
        }
      },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true, phone: true, role: true, avatarUrl: true } } }
        },
        messages: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          include: { sender: { select: { id: true, fullName: true, phone: true, role: true, avatarUrl: true } } }
        }
      },
      orderBy: [{ type: "asc" }, { updatedAt: "desc" }]
    });

    return Promise.all(
      items.map(async (conversation) => {
        const me = conversation.participants.find((participant) => participant.userId === actor.sub);
        const unreadCount = await prisma.conversationMessage.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: actor.sub },
            deletedAt: null,
            ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {})
          }
        });

        return {
          id: conversation.id,
          type: conversation.type,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          participants: conversation.participants,
          latestMessage: conversation.messages[0] ?? null,
          unreadCount
        };
      })
    );
  }

  const support = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.SUPPORT,
      participants: { some: { userId: actor.sub } }
    },
    include: {
      participants: {
        include: { user: { select: { id: true, fullName: true, phone: true, role: true, avatarUrl: true } } }
      },
      messages: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        include: { sender: { select: { id: true, fullName: true, phone: true, role: true, avatarUrl: true } } }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  if (!support) {
    return [];
  }

  const me = support.participants.find((participant) => participant.userId === actor.sub);
  const unreadCount = await prisma.conversationMessage.count({
    where: {
      conversationId: support.id,
      senderId: { not: actor.sub },
      deletedAt: null,
      ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {})
    }
  });

  return [
    {
      id: support.id,
      type: support.type,
      createdAt: support.createdAt,
      updatedAt: support.updatedAt,
      participants: support.participants,
      latestMessage: support.messages[0] ?? null,
      unreadCount
    }
  ];
}

export async function GET(): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const items = await buildItemsForActor(actor);
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const body = await parseJsonBody(request, createConversationSchema);

    if (body.type === "CENTER") {
      if (actor.role !== Role.ADMIN) {
        throw new ApiError(403, "FORBIDDEN", "Only admins can initialize center chat.");
      }

      const center = await prisma.$transaction(async (tx) => {
        const conversation = await ensureCenterConversation(tx);
        await ensureParticipant(tx, conversation.id, actor.sub);
        return tx.conversation.findUniqueOrThrow({
          where: { id: conversation.id },
          include: {
            participants: {
              include: { user: { select: { id: true, fullName: true, phone: true, role: true, avatarUrl: true } } }
            }
          }
        });
      });

      return ok({ item: center });
    }

    if (actor.role === Role.EMPLOYEE) {
      throw new ApiError(403, "FORBIDDEN", "Employees cannot create support conversations.");
    }

    const customerUserId = actor.role === Role.CUSTOMER ? actor.sub : body.customerUserId;
    if (!customerUserId) {
      throw new ApiError(400, "CUSTOMER_REQUIRED", "customerUserId is required.");
    }

    const customer = await prisma.user.findUnique({
      where: { id: customerUserId },
      select: { id: true, role: true, isActive: true }
    });

    if (!customer || !customer.isActive || customer.role !== Role.CUSTOMER) {
      throw new ApiError(400, "INVALID_CUSTOMER", "Valid active customer is required.");
    }

    const item = await prisma.$transaction(async (tx) => {
      const conversation = await ensureSupportConversationForCustomer(tx, customerUserId);
      if (actor.role === Role.ADMIN) {
        await ensureParticipant(tx, conversation.id, actor.sub);
      }

      return tx.conversation.findUniqueOrThrow({
        where: { id: conversation.id },
        include: {
          participants: {
            include: { user: { select: { id: true, fullName: true, phone: true, role: true, avatarUrl: true } } }
          }
        }
      });
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
