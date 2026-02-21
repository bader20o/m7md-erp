import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { env } from "@/lib/env";

const COOKIE_NAME = "session_token";
const encoder = new TextEncoder();
const secret = encoder.encode(env.AUTH_JWT_SECRET);

export type SessionPayload = {
  sub: string;
  role: Role;
  phone: string;
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

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, secret);
    const payload = verified.payload as SessionPayload;
    if (!payload?.sub || !payload?.role) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

