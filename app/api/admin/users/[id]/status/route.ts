import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const statusUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("activate")
  }),
  z.object({
    action: z.literal("suspend"),
    reason: z.string().max(300).optional()
  }),
  z.object({
    action: z.literal("ban"),
    durationDays: z.coerce.number().int().min(1).max(3650).optional(),
    banReason: z.string().max(300).optional(),
    banMessage: z.string().max(400).optional()
  }),
  z.object({
    action: z.literal("unban")
  })
]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, statusUpdateSchema);
    const { id } = await context.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true }
    });
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    }

    if (target.role === Role.ADMIN && body.action !== "activate") {
      throw new ApiError(400, "ADMIN_PROTECTED", "Admin account status cannot be changed with this endpoint.");
    }

    let item;
    if (body.action === "activate" || body.action === "unban") {
      item = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
          isActive: true,
          suspendedAt: null,
          suspensionReason: null,
          suspendedByAdminId: null,
          bannedUntil: null,
          banReason: null,
          banMessage: null,
          bannedByAdminId: null
        }
      });
    } else if (body.action === "suspend") {
      item = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.SUSPENDED,
          isActive: false,
          suspendedAt: new Date(),
          suspensionReason: body.reason ?? null,
          suspendedByAdminId: actor.sub
        }
      });
    } else {
      const bannedUntil = body.durationDays
        ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000)
        : null;
      item = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.BANNED,
          isActive: false,
          bannedUntil,
          banReason: body.banReason ?? null,
          banMessage: body.banMessage ?? null,
          bannedByAdminId: actor.sub
        }
      });
    }

    await logAudit({
      action: `USER_STATUS_${body.action.toUpperCase()}`,
      entity: "User",
      entityId: id,
      actorId: actor.sub,
      payload: {
        previousStatus: target.status,
        nextStatus: item.status
      }
    });

    return ok({
      item: {
        id: item.id,
        status: item.status.toLowerCase(),
        bannedUntil: item.bannedUntil
      }
    });
  } catch (error) {
    return fail(error);
  }
}

