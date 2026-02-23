import { Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { updateUserRoleSchema } from "@/lib/validators/admin-users";

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);

    const url = new URL(request.url);
    const role = url.searchParams.get("role");

    const items = await prisma.user.findMany({
      where: role ? { role: role as Role } : undefined,
      orderBy: { createdAt: "desc" },
      take: 300
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, updateUserRoleSchema);

    const target = await prisma.user.findUnique({
      where: { id: body.userId },
      select: {
        id: true,
        role: true,
        fullName: true,
        phone: true,
        locale: true,
        isActive: true,
        createdAt: true
      }
    });
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    }

    if (target.id === actor.sub && body.role !== Role.ADMIN) {
      throw new ApiError(400, "CANNOT_DEMOTE_SELF", "You cannot remove your own admin role.");
    }

    if (target.role === Role.ADMIN && body.role !== Role.ADMIN) {
      const activeAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, isActive: true }
      });
      if (activeAdmins <= 1) {
        throw new ApiError(400, "LAST_ADMIN", "Cannot change role for the last active admin user.");
      }
    }

    if (target.role === body.role) {
      return ok({ item: target });
    }

    const item = await prisma.user.update({
      where: { id: body.userId },
      data: { role: body.role },
      select: {
        id: true,
        role: true,
        fullName: true,
        phone: true,
        locale: true,
        isActive: true,
        createdAt: true
      }
    });

    await logAudit({
      action: "USER_ROLE_UPDATE",
      entity: "User",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        from: target.role,
        to: item.role
      }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}


