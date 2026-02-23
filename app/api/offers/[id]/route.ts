import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const updateOfferSchema = z.object({
  titleEn: z.string().min(2).max(160).optional(),
  titleAr: z.string().min(2).max(160).optional(),
  descriptionEn: z.string().max(1000).nullable().optional(),
  descriptionAr: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional()
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, updateOfferSchema);
    const { id } = await context.params;

    const item = await prisma.offer.update({
      where: { id },
      data: body
    });

    await logAudit({
      action: "OFFER_UPDATE",
      entity: "Offer",
      entityId: item.id,
      actorId: actor.sub
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
