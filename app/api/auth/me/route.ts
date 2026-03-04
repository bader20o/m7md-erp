import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { findSessionUserProfileById, getSessionResult } from "@/lib/auth";
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

    const user = await findSessionUserProfileById(sessionResult.session.sub);

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
