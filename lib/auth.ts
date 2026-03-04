import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { EmployeeRoleProfile, Prisma, Role, UserStatus } from "@prisma/client";
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

export type AuthUserRecord = {
  id: string;
  phone: string;
  passwordHash: string;
  role: Role;
  fullName: string | null;
  locale: string;
  isActive: boolean;
  status: UserStatus;
  bannedUntil: Date | null;
  banReason: string | null;
  banMessage: string | null;
  sessionVersion: number;
  forcePasswordReset: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
};

export type SessionUserProfile = {
  id: string;
  phone: string;
  role: Role;
  employeeId: string | null;
  roleProfile: EmployeeRoleProfile | null;
  status: UserStatus;
  avatarUrl: string | null;
  bio: string | null;
  carCompany: string | null;
  carType: string | null;
  carModel: string | null;
  carYear: string | null;
  location: string | null;
  fullName: string | null;
  locale: string;
  theme: string;
  isActive: boolean;
  forcePasswordReset: boolean;
  mustChangePassword: boolean;
  bannedUntil: Date | null;
  banReason: string | null;
  banMessage: string | null;
  createdAt: Date;
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

export function isPrismaSchemaCompatibilityError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function normalizeAuthUser(
  user: {
    id: string;
    phone: string;
    passwordHash: string;
    role: Role;
    fullName: string | null;
    locale?: string | null;
    isActive?: boolean | null;
    status?: UserStatus | null;
    bannedUntil?: Date | null;
    banReason?: string | null;
    banMessage?: string | null;
    sessionVersion?: number | null;
    forcePasswordReset?: boolean | null;
    mustChangePassword?: boolean | null;
    createdAt: Date;
  }
): AuthUserRecord {
  return {
    id: user.id,
    phone: user.phone,
    passwordHash: user.passwordHash,
    role: user.role,
    fullName: user.fullName ?? null,
    locale: user.locale ?? "en",
    isActive: user.isActive ?? true,
    status: user.status ?? UserStatus.ACTIVE,
    bannedUntil: user.bannedUntil ?? null,
    banReason: user.banReason ?? null,
    banMessage: user.banMessage ?? null,
    sessionVersion: user.sessionVersion ?? 0,
    forcePasswordReset: user.forcePasswordReset ?? false,
    mustChangePassword: user.mustChangePassword ?? false,
    createdAt: user.createdAt
  };
}

function normalizeSessionUserProfile(
  user: {
    id: string;
    phone: string;
    role: Role;
    employeeProfile?: {
      id: string;
      roleProfile: EmployeeRoleProfile;
    } | null;
    fullName: string | null;
    locale?: string | null;
    isActive?: boolean | null;
    status?: UserStatus | null;
    avatarUrl?: string | null;
    bio?: string | null;
    carCompany?: string | null;
    carType?: string | null;
    carModel?: string | null;
    carYear?: string | null;
    location?: string | null;
    theme?: string | null;
    forcePasswordReset?: boolean | null;
    mustChangePassword?: boolean | null;
    bannedUntil?: Date | null;
    banReason?: string | null;
    banMessage?: string | null;
    createdAt: Date;
  }
): SessionUserProfile {
  return {
    id: user.id,
    phone: user.phone,
    role: user.role,
    employeeId: user.employeeProfile?.id ?? null,
    roleProfile: user.employeeProfile?.roleProfile ?? null,
    status: user.status ?? UserStatus.ACTIVE,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    carCompany: user.carCompany ?? null,
    carType: user.carType ?? null,
    carModel: user.carModel ?? null,
    carYear: user.carYear ?? null,
    location: user.location ?? null,
    fullName: user.fullName ?? null,
    locale: user.locale ?? "en",
    theme: user.theme ?? "system",
    isActive: user.isActive ?? true,
    forcePasswordReset: user.forcePasswordReset ?? false,
    mustChangePassword: user.mustChangePassword ?? false,
    bannedUntil: user.bannedUntil ?? null,
    banReason: user.banReason ?? null,
    banMessage: user.banMessage ?? null,
    createdAt: user.createdAt
  };
}

export async function findAuthUserByPhone(phone: string): Promise<AuthUserRecord | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        passwordHash: true,
        role: true,
        fullName: true,
        locale: true,
        isActive: true,
        status: true,
        bannedUntil: true,
        banReason: true,
        banMessage: true,
        sessionVersion: true,
        forcePasswordReset: true,
        mustChangePassword: true,
        createdAt: true
      }
    });

    return user ? normalizeAuthUser(user) : null;
  } catch (error) {
    if (!isPrismaSchemaCompatibilityError(error)) {
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        passwordHash: true,
        role: true,
        fullName: true,
        locale: true,
        isActive: true,
        createdAt: true
      }
    });

    return user ? normalizeAuthUser(user) : null;
  }
}

export async function findAuthUserById(id: string): Promise<AuthUserRecord | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        passwordHash: true,
        role: true,
        fullName: true,
        locale: true,
        isActive: true,
        status: true,
        bannedUntil: true,
        banReason: true,
        banMessage: true,
        sessionVersion: true,
        forcePasswordReset: true,
        mustChangePassword: true,
        createdAt: true
      }
    });

    return user ? normalizeAuthUser(user) : null;
  } catch (error) {
    if (!isPrismaSchemaCompatibilityError(error)) {
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        passwordHash: true,
        role: true,
        fullName: true,
        locale: true,
        isActive: true,
        createdAt: true
      }
    });

    return user ? normalizeAuthUser(user) : null;
  }
}

export async function findSessionUserProfileById(id: string): Promise<SessionUserProfile | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        role: true,
        employeeProfile: {
          select: {
            id: true,
            roleProfile: true
          }
        },
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

    return user ? normalizeSessionUserProfile(user) : null;
  } catch (error) {
    if (!isPrismaSchemaCompatibilityError(error)) {
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        role: true,
        employeeProfile: {
          select: {
            id: true,
            roleProfile: true
          }
        },
        fullName: true,
        locale: true,
        isActive: true,
        createdAt: true
      }
    });

    return user ? normalizeSessionUserProfile(user) : null;
  }
}

export async function recordLoginMetadata(
  userId: string,
  metadata: { ipAddress: string | null; userAgent: string | null }
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: metadata.ipAddress,
        lastLoginUserAgent: metadata.userAgent
      }
    });
  } catch (error) {
    if (!isPrismaSchemaCompatibilityError(error)) {
      throw error;
    }
  }
}

export async function recordLogoutMetadata(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLogoutAt: new Date()
      }
    });
  } catch (error) {
    if (!isPrismaSchemaCompatibilityError(error)) {
      throw error;
    }
  }
}

async function restoreActiveUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.ACTIVE,
      isActive: true
    }
  });
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

    const user = await findAuthUserById(payload.sub);

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
        await restoreActiveUser(user.id);
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
        await restoreActiveUser(user.id);
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
