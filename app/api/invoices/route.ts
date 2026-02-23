import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const createInvoiceSchema = z.object({
  number: z.string().min(2).max(80),
  note: z.string().max(500).optional(),
  dueDate: z.coerce.date().optional()
});

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const items = await prisma.invoice.findMany({
      include: { expenses: true },
      orderBy: { issueDate: "desc" }
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, createInvoiceSchema);
    const item = await prisma.invoice.create({
      data: {
        number: body.number,
        note: body.note,
        dueDate: body.dueDate
      }
    });
    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}


