import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const createPlanSchema = z.object({
  tier: z.string().min(1).max(50),
  nameEn: z.string().min(2).max(120),
  nameAr: z.string().min(2).max(120),
  imageUrl: z.string().max(1000).optional(),
  descriptionEn: z.string().max(1000).optional(),
  descriptionAr: z.string().max(1000).optional(),
  price: z.coerce.number().positive(),
  durationDays: z.coerce.number().int().positive(),
  color: z.string().optional()
});

export async function GET(): Promise<Response> {
  try {
    const items = await prisma.membershipPlan.findMany({
      where: { isActive: true },
      include: { entitlements: { include: { service: true } } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, createPlanSchema);
    const item = await prisma.membershipPlan.create({ data: body });
    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}


