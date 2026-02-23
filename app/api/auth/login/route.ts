import { UserStatus } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { evaluateBan, toRemainingDurationLabel } from "@/lib/account-status";
import { logAudit } from "@/lib/audit";
import { setSessionCookie, signSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request, loginSchema);

    const user = await prisma.user.findUnique({
      where: { phone: body.phone }
    });

    if (!user) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid phone or password.");
    }

    if (user.status === UserStatus.SUSPENDED || !user.isActive) {
      throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
    }

    const banState = evaluateBan(user.status, user.bannedUntil);
    if (banState.isBanned) {
      throw new ApiError(403, "ACCOUNT_BANNED", user.banMessage || "This account is banned.", {
        banReason: user.banReason,
        banMessage: user.banMessage,
        bannedUntil: user.bannedUntil,
        remainingDuration: toRemainingDurationLabel(banState.remainingMs),
        isPermanent: banState.isPermanent
      });
    }

    if (user.status === UserStatus.BANNED && !banState.isBanned) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          isActive: true,
          bannedUntil: null,
          banReason: null,
          banMessage: null,
          bannedByAdminId: null
        }
      });
    }

    const isValid = await verifyPassword(body.password, user.passwordHash);
    if (!isValid) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid phone or password.");
    }

    const token = await signSession({
      sub: user.id,
      phone: user.phone,
      role: user.role
    });
    await setSessionCookie(token);

    await logAudit({
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      actorId: user.id
    });

    return ok({
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        fullName: user.fullName,
        mustChangePassword: user.mustChangePassword,
        forcePasswordReset: user.forcePasswordReset
      }
    });
  } catch (error) {
    return fail(error);
  }
}
