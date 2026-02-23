import { Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPermissionsForUser, requireSession } from "@/lib/rbac";
import { decryptSensitive } from "@/lib/security";

const profileUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_profile"),
    fullName: z.string().min(2).max(120).optional(),
    bio: z.string().max(280).nullable().optional(),
    carType: z.string().max(120).nullable().optional(),
    location: z.string().max(120).nullable().optional(),
    avatarUrl: z.string().max(1000).nullable().optional(),
    locale: z.enum(["en", "ar"]).optional(),
    theme: z.enum(["light", "dark", "system"]).optional()
  }),
  z.object({
    action: z.literal("change_password"),
    oldPassword: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128)
  })
]);

export async function GET(): Promise<Response> {
  try {
    const session = requireSession(await getSession());
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: {
        employeeProfile: {
          include: {
            permissionGrants: {
              select: { permission: true }
            }
          }
        }
      }
    });

    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    }

    const permissions = await getPermissionsForUser(user.id, user.role);

    return ok({
      user: {
        id: user.id,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        bio: user.bio,
        carType: user.carType,
        location: user.location,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        theme: user.theme,
        status: user.status.toLowerCase(),
        joinedAt: user.createdAt,
        forcePasswordReset: user.forcePasswordReset,
        mustChangePassword: user.mustChangePassword,
        permissions,
        hr:
          user.role === Role.EMPLOYEE && user.employeeProfile
            ? {
                nationalId: decryptSensitive(user.employeeProfile.nationalIdEncrypted),
                birthDate: decryptSensitive(user.employeeProfile.birthDateEncrypted),
                jobTitle: decryptSensitive(user.employeeProfile.jobTitleEncrypted),
                defaultSalaryInfo: user.employeeProfile.defaultSalaryEncrypted
                  ? JSON.parse(decryptSensitive(user.employeeProfile.defaultSalaryEncrypted))
                  : null,
                workSchedule: user.employeeProfile.workScheduleEncrypted
                  ? JSON.parse(decryptSensitive(user.employeeProfile.workScheduleEncrypted))
                  : null,
                idCardImageUrl: user.employeeProfile.idCardImageUrl,
                profilePhotoUrl: user.employeeProfile.profilePhotoUrl
              }
            : null
      }
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = requireSession(await getSession());
    const body = await parseJsonBody(request, profileUpdateSchema);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        role: true,
        passwordHash: true
      }
    });
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    }

    if (body.action === "change_password") {
      if (body.newPassword !== body.confirmPassword) {
        throw new ApiError(400, "PASSWORD_MISMATCH", "New password and confirm password do not match.");
      }

      const isCurrentPasswordValid = await verifyPassword(body.oldPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new ApiError(400, "OLD_PASSWORD_INVALID", "Old password is incorrect.");
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(body.newPassword),
          forcePasswordReset: false,
          mustChangePassword: false,
          lastPasswordChangeAt: new Date()
        }
      });

      return ok({ updated: true });
    }

    if (user.role === Role.CUSTOMER) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: body.fullName,
          bio: body.bio,
          carType: body.carType,
          location: body.location,
          avatarUrl: body.avatarUrl
        }
      });
    } else if (user.role === Role.EMPLOYEE) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: body.avatarUrl ?? undefined
        }
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: body.fullName,
          avatarUrl: body.avatarUrl,
          locale: body.locale,
          theme: body.theme
        }
      });
    }

    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}

