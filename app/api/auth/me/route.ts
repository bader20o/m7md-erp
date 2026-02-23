import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPermissionsForUser } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return ok({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        bio: true,
        carType: true,
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
      return ok({ user: null });
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
    return fail(error);
  }
}
