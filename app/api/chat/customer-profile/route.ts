import { ConversationType, Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { assertCanAccessConversation } from "@/lib/chat";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const querySchema = z.object({
  conversationId: z.string().min(1)
});

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    if (actor.role !== Role.ADMIN) {
      throw new ApiError(403, "FORBIDDEN", "Only admin can view customer profile details.");
    }

    const url = new URL(request.url);
    const query = await querySchema.parseAsync({
      conversationId: url.searchParams.get("conversationId") ?? url.searchParams.get("threadId") ?? undefined
    });

    const conversation = await assertCanAccessConversation(prisma, query.conversationId, actor);
    if (conversation.type !== ConversationType.SUPPORT) {
      return ok({ customer: null, lastBooking: null });
    }

    const customerParticipant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: query.conversationId,
        user: { role: Role.CUSTOMER }
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!customerParticipant) {
      return ok({ customer: null, lastBooking: null });
    }

    const lastBooking = await prisma.booking.findFirst({
      where: { customerId: customerParticipant.userId },
      select: {
        id: true,
        status: true,
        appointmentAt: true,
        finalPrice: true,
        serviceNameSnapshotEn: true,
        serviceNameSnapshotAr: true
      },
      orderBy: { appointmentAt: "desc" }
    });

    return ok({
      customer: customerParticipant.user,
      lastBooking
    });
  } catch (error) {
    return fail(error);
  }
}
