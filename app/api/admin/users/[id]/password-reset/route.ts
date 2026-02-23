import { Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { generateTemporaryPassword } from "@/lib/security";

const passwordResetSchema = z.object({
  forceOnly: z.boolean().default(false)
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, passwordResetSchema);
    const { id } = await context.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true }
    });
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    }

    let temporaryPassword: string | null = null;

    if (body.forceOnly) {
      await prisma.user.update({
        where: { id },
        data: {
          forcePasswordReset: true,
          mustChangePassword: true
        }
      });
    } else {
      temporaryPassword = generateTemporaryPassword();
      await prisma.user.update({
        where: { id },
        data: {
          passwordHash: await hashPassword(temporaryPassword),
          forcePasswordReset: true,
          mustChangePassword: true,
          lastPasswordChangeAt: null
        }
      });
    }

    await logAudit({
      action: "USER_PASSWORD_RESET",
      entity: "User",
      entityId: id,
      actorId: actor.sub,
      payload: {
        forceOnly: body.forceOnly
      }
    });

    return ok({ temporaryPassword });
  } catch (error) {
    return fail(error);
  }
}

