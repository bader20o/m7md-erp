import { Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";

const updatePlanSchema = z.object({
  nameEn: z.string().min(2).max(120).optional(),
  nameAr: z.string().min(2).max(120).optional(),
  imageUrl: z.string().max(1000).nullable().optional(),
  descriptionEn: z.string().max(1000).nullable().optional(),
  descriptionAr: z.string().max(1000).nullable().optional(),
  price: z.coerce.number().positive().optional(),
  durationDays: z.coerce.number().int().positive().optional(),
  color: z.string().nullable().optional(),
  isActive: z.boolean().optional()
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["memberships"]);
    }

    const body = await parseJsonBody(request, updatePlanSchema);
    const { id } = await context.params;

    const exists = await prisma.membershipPlan.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) {
      throw new ApiError(404, "PLAN_NOT_FOUND", "Membership plan not found.");
    }

    const item = await prisma.membershipPlan.update({
      where: { id },
      data: body
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}

