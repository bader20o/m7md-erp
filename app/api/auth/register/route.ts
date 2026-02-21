import { Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { hashPassword, setSessionCookie, signSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators/auth";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request, registerSchema);

    const existing = await prisma.user.findUnique({
      where: { phone: body.phone },
      select: { id: true }
    });

    if (existing) {
      throw new ApiError(409, "PHONE_ALREADY_EXISTS", "This phone number is already in use.");
    }

    const user = await prisma.user.create({
      data: {
        phone: body.phone,
        passwordHash: await hashPassword(body.password),
        fullName: body.fullName,
        locale: body.locale,
        role: Role.CUSTOMER
      },
      select: {
        id: true,
        phone: true,
        role: true,
        fullName: true
      }
    });

    const token = await signSession({
      sub: user.id,
      phone: user.phone,
      role: user.role
    });
    await setSessionCookie(token);

    await logAudit({
      action: "REGISTER",
      entity: "User",
      entityId: user.id,
      actorId: user.id
    });

    return ok({ user }, 201);
  } catch (error) {
    return fail(error);
  }
}

