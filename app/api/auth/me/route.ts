import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { getSessionResult } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPermissionsForUser } from "@/lib/rbac";

function unauthorized(code: string, message: string): Response {
  return NextResponse.json(
    {
      ok: false,
      success: false,
      error: {
        code,
        message
      }
    },
    { status: 401 }
  );
}

function internalAuthError(): Response {
  return NextResponse.json(
    {
      ok: false,
      success: false,
      error: {
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "Authentication service is temporarily unavailable."
      }
    },
    { status: 500 }
  );
}

export async function GET(): Promise<Response> {
  try {
    const sessionResult = await getSessionResult();
    if (!sessionResult.ok) {
      return unauthorized(sessionResult.code, sessionResult.message);
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionResult.session.sub },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        bio: true,
        carCompany: true,
        carType: true,
        carModel: true,
        carYear: true,
        location: true,
        fullName: true,
        locale: true,
        theme: true,
        isActive: true,
        forcePasswordReset: true,
        mustChangePassword: true,
        bannedUntil: true,
        banReason: true,
        banMessage: true,
        createdAt: true
      }
    });

    if (!user) {
      return unauthorized("USER_NOT_FOUND", "Session user no longer exists.");
    }

    const permissions = await getPermissionsForUser(user.id, user.role);

    return ok({
      user: {
        ...user,
        joinedAt: user.createdAt,
        permissions
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001")
    ) {
      console.error(error);
      return internalAuthError();
    }

    return fail(error);
  }
}
