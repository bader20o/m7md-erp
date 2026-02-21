import { ReviewStatus, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { moderateReviewSchema } from "@/lib/validators/review";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, moderateReviewSchema);
    const { id } = await context.params;

    const review = await prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!review) {
      throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
    }

    const item = await prisma.review.update({
      where: { id },
      data: {
        status: body.status === "APPROVED" ? ReviewStatus.APPROVED : ReviewStatus.REJECTED,
        moderatedAt: new Date(),
        moderationReason: body.reason,
        moderatedById: actor.sub
      }
    });

    await logAudit({
      action: "REVIEW_MODERATE",
      entity: "Review",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        status: item.status,
        moderationReason: item.moderationReason
      }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
