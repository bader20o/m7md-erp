import { Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const querySchema = z.object({
  threadId: z.string().min(1)
});

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    if (actor.role !== Role.ADMIN) {
      throw new ApiError(403, "FORBIDDEN", "Only admin can view customer profile details.");
    }

    const url = new URL(request.url);
    const query = await querySchema.parseAsync({
      threadId: url.searchParams.get("threadId") ?? undefined
    });

    const participant = await prisma.chatParticipant.findUnique({
      where: {
        threadId_userId: {
          threadId: query.threadId,
          userId: actor.sub
        }
      },
      select: { id: true }
    });
    if (!participant) {
      throw new ApiError(403, "FORBIDDEN", "Not a participant in this thread.");
    }

    const customerParticipant = await prisma.chatParticipant.findFirst({
      where: {
        threadId: query.threadId,
        user: { role: { not: Role.ADMIN } }
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true
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
