import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Prisma, Role, UserStatus } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "session_token";
const encoder = new TextEncoder();
const secret = encoder.encode(env.AUTH_JWT_SECRET);

export type SessionPayload = {
  sub: string;
  role: Role;
  phone: string;
  sessionVersion: number;
};

export type SessionLookupResult =
  | { ok: true; session: SessionPayload }
  | {
      ok: false;
      code: "NO_SESSION" | "INVALID_SESSION" | "USER_NOT_FOUND";
      message: string;
    };

export async function hashPassword(value: string): Promise<string> {
  return bcrypt.hash(value, 10);
}

export async function verifyPassword(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

function isJwtSessionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    [
      "JWTExpired",
      "JWTInvalid",
      "JWTClaimValidationFailed",
      "JWSInvalid",
      "JWSSignatureVerificationFailed"
    ].includes(error.name)
  );
}

function isPrismaConnectionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001")
  );
}

export async function getSessionResult(): Promise<SessionLookupResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return {
      ok: false,
      code: "NO_SESSION",
      message: "No active session."
    };
  }

  try {
    const verified = await jwtVerify(token, secret);
    const payload = verified.payload as SessionPayload;
    if (!payload?.sub || !payload?.role || typeof payload.sessionVersion !== "number") {
      return {
        ok: false,
        code: "INVALID_SESSION",
        message: "Invalid or expired session token."
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        bannedUntil: true,
        isActive: true,
        sessionVersion: true
      }
    });

    if (!user) {
      return {
        ok: false,
        code: "USER_NOT_FOUND",
        message: "Session user no longer exists."
      };
    }

    if (payload.sessionVersion !== user.sessionVersion) {
      return {
        ok: false,
        code: "INVALID_SESSION",
        message: "Invalid or expired session token."
      };
    }

    if (user.status === UserStatus.SUSPENDED) {
      if (user.bannedUntil && user.bannedUntil.getTime() <= Date.now()) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.ACTIVE,
            isActive: true,
            bannedUntil: null,
            suspendedAt: null,
            suspensionReason: null,
            suspendedByAdminId: null
          }
        });
      } else {
        return {
          ok: false,
          code: "INVALID_SESSION",
          message: "Invalid or expired session token."
        };
      }
    }

    if (user.status === UserStatus.BANNED) {
      if (user.bannedUntil && user.bannedUntil.getTime() <= Date.now()) {
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
      } else {
        return {
          ok: false,
          code: "INVALID_SESSION",
          message: "Invalid or expired session token."
        };
      }
    }

    if (user.status === UserStatus.SUSPENDED || !user.isActive) {
      return {
        ok: false,
        code: "INVALID_SESSION",
        message: "Invalid or expired session token."
      };
    }

    return {
      ok: true,
      session: {
        sub: user.id,
        role: user.role,
        phone: user.phone,
        sessionVersion: user.sessionVersion
      }
    };
  } catch (error) {
    if (isJwtSessionError(error)) {
      return {
        ok: false,
        code: "INVALID_SESSION",
        message: "Invalid or expired session token."
      };
    }

    if (isPrismaConnectionError(error)) {
      throw error;
    }

    throw error;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const result = await getSessionResult();
  return result.ok ? result.session : null;
}
