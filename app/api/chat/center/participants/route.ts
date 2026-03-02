import { ConversationType, Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { ensureCenterConversation, ensureParticipant } from "@/lib/chat";
import { publishChatEvent } from "@/lib/chat-events";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const manageSchema = z.object({
  userId: z.string().min(1)
});

async function getCenterWithParticipants(): Promise<{
  id: string;
  participants: Array<{
    userId: string;
    user: { id: string; fullName: string | null; phone: string; role: Role };
  }>;
}> {
  const center = await prisma.$transaction(async (tx) => {
    const conversation = await ensureCenterConversation(tx);
    return tx.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true, phone: true, role: true } } },
          orderBy: [{ joinedAt: "asc" }]
        }
      }
    });
  });

  return { id: center.id, participants: center.participants };
}

export async function GET(): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const center = await getCenterWithParticipants();

    const isParticipant = center.participants.some((participant) => participant.userId === actor.sub);
    if (actor.role !== Role.ADMIN && !isParticipant) {
      throw new ApiError(403, "FORBIDDEN", "Not a center chat participant.");
    }

    if (actor.role === Role.ADMIN) {
      await ensureParticipant(prisma, center.id, actor.sub);
    }

    return ok({
      conversationId: center.id,
      participants: center.participants
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    if (actor.role !== Role.ADMIN) {
      throw new ApiError(403, "FORBIDDEN", "Only admins can add center participants.");
    }

    const body = await parseJsonBody(request, manageSchema);

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, role: true, isActive: true }
    });
    if (!user || !user.isActive || user.role !== Role.EMPLOYEE) {
      throw new ApiError(400, "INVALID_EMPLOYEE", "Only active employees can be added.");
    }

    const center = await prisma.$transaction(async (tx) => {
      const conversation = await ensureCenterConversation(tx);
      await ensureParticipant(tx, conversation.id, actor.sub);
      await ensureParticipant(tx, conversation.id, body.userId);
      return tx.conversation.findUniqueOrThrow({
        where: { id: conversation.id },
        include: {
          participants: {
            include: { user: { select: { id: true, fullName: true, phone: true, role: true } } }
          }
        }
      });
    });

    const recipients = center.participants.map((participant) => participant.userId);
    publishChatEvent("participant:added", recipients, {
      conversationId: center.id,
      userId: body.userId
    });

    return ok({ conversationId: center.id, participants: center.participants });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    if (actor.role !== Role.ADMIN) {
      throw new ApiError(403, "FORBIDDEN", "Only admins can remove center participants.");
    }

    const body = await parseJsonBody(request, manageSchema);

    const center = await prisma.conversation.findFirst({
      where: { type: ConversationType.CENTER },
      select: { id: true }
    });
    if (!center) {
      return ok({ removed: true });
    }

    const target = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, role: true }
    });
    if (!target || target.role !== Role.EMPLOYEE) {
      throw new ApiError(400, "INVALID_EMPLOYEE", "Only employees can be removed.");
    }

    await prisma.conversationParticipant.deleteMany({
      where: {
        conversationId: center.id,
        userId: body.userId
      }
    });

    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: center.id },
      select: { userId: true }
    });
    publishChatEvent(
      "participant:removed",
      Array.from(new Set([...participants.map((item) => item.userId), body.userId])),
      { conversationId: center.id, userId: body.userId }
    );

    return ok({ removed: true });
  } catch (error) {
    return fail(error);
  }
}
