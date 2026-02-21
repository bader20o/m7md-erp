import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const updateAboutSchema = z.object({
  centerNameEn: z.string().min(2).max(200),
  centerNameAr: z.string().min(2).max(200),
  descriptionEn: z.string().max(2000).optional(),
  descriptionAr: z.string().max(2000).optional(),
  mapEmbedUrl: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  instagramUrl: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
  xUrl: z.string().url().optional()
});

export async function GET(): Promise<Response> {
  try {
    const item = await prisma.aboutSettings.findUnique({ where: { id: 1 } });
    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, updateAboutSchema);

    const item = await prisma.aboutSettings.upsert({
      where: { id: 1 },
      update: body,
      create: { id: 1, ...body }
    });

    await logAudit({
      action: "ABOUT_UPDATE",
      entity: "AboutSettings",
      entityId: String(item.id),
      actorId: actor.sub
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
