import { Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const createOfferSchema = z.object({
  titleEn: z.string().min(2).max(160),
  titleAr: z.string().min(2).max(160),
  descriptionEn: z.string().max(1000).optional(),
  descriptionAr: z.string().max(1000).optional(),
  imageUrl: z.string().max(1000).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
  serviceIds: z.array(z.string()).optional()
});

export async function GET(): Promise<Response> {
  try {
    const items = await prisma.offer.findMany({
      where: { isActive: true },
      include: { services: { include: { service: true } } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, createOfferSchema);
    const uniqueServiceIds = body.serviceIds ? Array.from(new Set(body.serviceIds)) : [];

    if (uniqueServiceIds.length) {
      const existingServices = await prisma.service.findMany({
        where: { id: { in: uniqueServiceIds } },
        select: { id: true }
      });
      if (existingServices.length !== uniqueServiceIds.length) {
        throw new ApiError(400, "INVALID_SERVICE_IDS", "One or more selected services do not exist.");
      }
    }

    const item = await prisma.offer.create({
      data: {
        titleEn: body.titleEn,
        titleAr: body.titleAr,
        descriptionEn: body.descriptionEn,
        descriptionAr: body.descriptionAr,
        imageUrl: body.imageUrl,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        isActive: body.isActive,
        services: uniqueServiceIds.length
          ? {
              createMany: {
                data: uniqueServiceIds.map((serviceId) => ({ serviceId }))
              }
            }
          : undefined
      },
      include: {
        services: true
      }
    });

    await logAudit({
      action: "OFFER_CREATE",
      entity: "Offer",
      entityId: item.id,
      actorId: actor.sub
    });

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}

