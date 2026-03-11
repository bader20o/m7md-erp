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
  email: z.string().email().max(160).nullable().optional(),
  whatsapp: z.string().max(30).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  instagram: z.string().max(300).nullable().optional(),
  facebook: z.string().max(300).nullable().optional(),
  tiktok: z.string().max(300).nullable().optional(),
  youtube: z.string().max(300).nullable().optional(),
  workingHours: z.array(
    z.object({
      day: z.number().int().min(0).max(6),
      open: z.string().min(3).max(16),
      close: z.string().min(3).max(16),
      closed: z.boolean().default(false),
      splitShifts: z
        .array(
          z.object({
            open: z.string().min(3).max(16),
            close: z.string().min(3).max(16)
          })
        )
        .max(2)
        .optional()
    })
  ),
  holidays: z.array(
    z.object({
      date: z.string().min(4).max(32),
      label: z.string().min(1).max(120)
    })
  )
});

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const item = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    if (!item) {
      return ok({ item: null });
    }
    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, updateSystemSettingsSchema);
    const normalizeOptional = (value: string | null | undefined): string | null => {
      if (typeof value !== "string") return null;
      const normalized = value.trim();
      return normalized.length ? normalized : null;
    };

    const item = await prisma.systemSetting.upsert({
      where: { id: 1 },
      update: {
        businessName: body.businessName,
        businessPhone: body.businessPhone,
        businessAddress: body.businessAddress,
        email: normalizeOptional(body.email),
        whatsapp: normalizeOptional(body.whatsapp),
        website: normalizeOptional(body.website),
        instagram: normalizeOptional(body.instagram),
        facebook: normalizeOptional(body.facebook),
        tiktok: normalizeOptional(body.tiktok),
        youtube: normalizeOptional(body.youtube),
        workingHours: body.workingHours,
        holidays: body.holidays,
        currency: "JOD",
        defaultCurrency: "JOD"
      },
      create: {
        id: 1,
        businessName: body.businessName,
        businessPhone: body.businessPhone,
        businessAddress: body.businessAddress,
        email: normalizeOptional(body.email),
        whatsapp: normalizeOptional(body.whatsapp),
        website: normalizeOptional(body.website),
        instagram: normalizeOptional(body.instagram),
        facebook: normalizeOptional(body.facebook),
        tiktok: normalizeOptional(body.tiktok),
        youtube: normalizeOptional(body.youtube),
        workingHours: body.workingHours,
        holidays: body.holidays,
        currency: "JOD",
        defaultCurrency: "JOD"
      }
    });

    await logAudit({
      action: "SYSTEM_SETTINGS_UPDATE",
      entity: "SystemSetting",
      entityId: String(item.id),
      actorId: actor.sub,
      payload: {
        businessName: item.businessName,
        email: item.email,
        whatsapp: item.whatsapp,
        currency: "JOD"
      }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
