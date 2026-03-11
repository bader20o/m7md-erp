import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const createServiceSchema = z.object({
  nameEn: z.string().min(2).max(160),
  nameAr: z.string().min(2).max(160),
  category: z.string().max(120).nullable().optional(),
  basePrice: z.coerce.number().min(0).max(100000).nullable().optional(),
  supportedCarTypes: z.string().max(200).nullable().optional(),
  imageUrl: z.string().max(1000).optional(),
  descriptionEn: z.string().max(1000).optional(),
  descriptionAr: z.string().max(1000).optional(),
  durationMinutes: z.coerce.number().int().min(15).max(600)
});

export async function GET(): Promise<Response> {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        descriptionEn: true,
        descriptionAr: true,
        imageUrl: true,
        category: true,
        basePrice: true,
        priceType: true,
        supportedCarTypes: true,
        durationMinutes: true,
        isActive: true
      },
      orderBy: { createdAt: "desc" }
    });
    return ok({ items: services });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN, Role.EMPLOYEE]);
    const body = await parseJsonBody(request, createServiceSchema);

    const service = await prisma.service.create({ data: body });

    return ok({ item: service }, 201);
  } catch (error) {
    return fail(error);
  }
}

