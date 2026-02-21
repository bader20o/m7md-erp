import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const updateSystemSettingsSchema = z.object({
  cancellationPolicyHours: z.number().int().min(1).max(168),
  lateCancellationHours: z.number().int().min(0).max(48),
  defaultCurrency: z.string().min(3).max(3),
  timezone: z.string().min(2).max(100)
});

export async function GET(): Promise<Response> {
  try {
    const item = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, updateSystemSettingsSchema);

    const item = await prisma.systemSetting.upsert({
      where: { id: 1 },
      update: body,
      create: {
        id: 1,
        ...body
      }
    });

    await logAudit({
      action: "SYSTEM_SETTINGS_UPDATE",
      entity: "SystemSetting",
      entityId: String(item.id),
      actorId: actor.sub,
      payload: {
        cancellationPolicyHours: item.cancellationPolicyHours,
        lateCancellationHours: item.lateCancellationHours
      }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
