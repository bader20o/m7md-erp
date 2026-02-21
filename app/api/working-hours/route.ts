import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const updateWorkingHoursSchema = z.object({
  items: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/),
        isClosed: z.boolean()
      })
    )
    .min(1)
    .max(7)
});

export async function GET(): Promise<Response> {
  try {
    const items = await prisma.workingHour.findMany({
      orderBy: { dayOfWeek: "asc" }
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, updateWorkingHoursSchema);

    const updates = await Promise.all(
      body.items.map((item) =>
        prisma.workingHour.upsert({
          where: { dayOfWeek: item.dayOfWeek },
          update: {
            openTime: item.openTime,
            closeTime: item.closeTime,
            isClosed: item.isClosed
          },
          create: item
        })
      )
    );

    await logAudit({
      action: "WORKING_HOURS_UPDATE",
      entity: "WorkingHour",
      actorId: actor.sub,
      payload: {
        updatedCount: updates.length
      }
    });

    return ok({ items: updates });
  } catch (error) {
    return fail(error);
  }
}
