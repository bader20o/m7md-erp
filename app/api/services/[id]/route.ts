import { Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const updateServiceSchema = z.object({
  nameEn: z.string().min(2).max(160).optional(),
  nameAr: z.string().min(2).max(160).optional(),
  descriptionEn: z.string().max(1000).nullable().optional(),
  descriptionAr: z.string().max(1000).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(600).optional(),
  isActive: z.boolean().optional()
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Params): Promise<Response> {
  try {
    const { id } = await context.params;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new ApiError(404, "SERVICE_NOT_FOUND", "Service not found.");
    }
    return ok({ item: service });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN, Role.MANAGER]);
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateServiceSchema);

    const service = await prisma.service.update({
      where: { id },
      data: body
    });

    return ok({ item: service });
  } catch (error) {
    return fail(error);
  }
}
