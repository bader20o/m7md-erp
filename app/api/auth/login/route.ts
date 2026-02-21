import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
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

    if (!user || !user.isActive) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid phone or password.");
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
        fullName: user.fullName
      }
    });
  } catch (error) {
    return fail(error);
  }
}

