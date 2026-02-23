import { Role } from "@prisma/client";
import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const updateSystemSettingsSchema = z.object({
  businessName: z.string().min(2).max(160),
  businessPhone: z.string().min(7).max(30),
  businessAddress: z.string().min(2).max(240),
  workingHours: z.array(
    z.object({
      day: z.number().int().min(0).max(6),
      open: z.string().min(3).max(16),
      close: z.string().min(3).max(16),
      closed: z.boolean().default(false)
    })
  ),
  holidays: z.array(
    z.object({
      date: z.string().min(4).max(32),
      label: z.string().min(1).max(120)
    })
  ),
  currency: z.string().min(3).max(8)
});

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const item = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, updateSystemSettingsSchema);

    const item = await prisma.systemSetting.upsert({
      where: { id: 1 },
      update: {
        businessName: body.businessName,
        businessPhone: body.businessPhone,
        businessAddress: body.businessAddress,
        workingHours: body.workingHours,
        holidays: body.holidays,
        currency: body.currency,
        defaultCurrency: body.currency
      },
      create: {
        id: 1,
        businessName: body.businessName,
        businessPhone: body.businessPhone,
        businessAddress: body.businessAddress,
        workingHours: body.workingHours,
        holidays: body.holidays,
        currency: body.currency,
        defaultCurrency: body.currency
      }
    });

    await logAudit({
      action: "SYSTEM_SETTINGS_UPDATE",
      entity: "SystemSetting",
      entityId: String(item.id),
      actorId: actor.sub,
      payload: {
        businessName: item.businessName,
        currency: item.currency
      }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}

