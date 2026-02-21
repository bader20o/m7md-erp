import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const createSupplierSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  address: z.string().max(300).optional()
});

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ACCOUNTANT, Role.MANAGER, Role.ADMIN]);
    const items = await prisma.supplier.findMany({
      orderBy: { name: "asc" }
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ACCOUNTANT, Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, createSupplierSchema);
    const item = await prisma.supplier.create({ data: body });
    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}

