import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appToDbPermission, requireRoles } from "@/lib/rbac";
import { createLookupHash, decryptSensitive, encryptSensitive, generateTemporaryPassword } from "@/lib/security";
import { updateEmployeeHrSchema } from "@/lib/validators/employee";

const updateEmployeeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    reason: z.string().max(300).optional()
  }),
  z.object({
    action: z.literal("activate")
  }),
  z.object({
    action: z.literal("ban"),
    durationDays: z.coerce.number().int().min(1).max(3650).optional(),
    banReason: z.string().max(300).optional(),
    banMessage: z.string().max(400).optional()
  }),
  z.object({
    action: z.literal("unban")
  }),
  z.object({
    action: z.literal("reset_password")
  }),
  z.object({
    action: z.literal("resend_credentials")
  }),
  z.object({
    action: z.literal("force_password_reset")
  }),
  z.object({
    action: z.literal("update_permissions"),
    permissions: z
      .array(z.enum(["accounting", "warehouse", "bookings", "hr", "memberships", "analytics", "services"]))
      .default([])
  }),
  z.object({
    action: z.literal("update_hr"),
    data: updateEmployeeHrSchema
  })
]);

type Params = { params: Promise<{ id: string }> };

function serializeEmployee(item: {
  id: string;
  userId: string;
  nationalIdEncrypted: string;
  birthDateEncrypted: string;
  jobTitleEncrypted: string;
  defaultSalaryEncrypted: string | null;
  workScheduleEncrypted: string | null;
  idCardImageUrl: string | null;
  profilePhotoUrl: string | null;
  user: {
    id: string;
    fullName: string | null;
    phone: string;
    status: UserStatus;
    createdAt: Date;
    bannedUntil: Date | null;
    banReason: string | null;
    banMessage: string | null;
  };
  permissionGrants: Array<{ permission: string }>;
}) {
  return {
    id: item.id,
    userId: item.userId,
    fullName: item.user.fullName,
    phone: item.user.phone,
    joinedAt: item.user.createdAt,
    status: item.user.status.toLowerCase(),
    bannedUntil: item.user.bannedUntil,
    banReason: item.user.banReason,
    banMessage: item.user.banMessage,
    hr: {
      nationalId: decryptSensitive(item.nationalIdEncrypted),
      birthDate: decryptSensitive(item.birthDateEncrypted),
      jobTitle: decryptSensitive(item.jobTitleEncrypted),
      defaultSalaryInfo: item.defaultSalaryEncrypted
        ? JSON.parse(decryptSensitive(item.defaultSalaryEncrypted))
        : null,
      workSchedule: item.workScheduleEncrypted ? JSON.parse(decryptSensitive(item.workScheduleEncrypted)) : null,
      idCardImageUrl: item.idCardImageUrl,
      profilePhotoUrl: item.profilePhotoUrl
    },
    permissions: item.permissionGrants.map((entry) => entry.permission.toLowerCase())
  };
}

export async function GET(_: Request, context: Params): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const { id } = await context.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
            bannedUntil: true,
            banReason: true,
            banMessage: true
          }
        },
        permissionGrants: {
          select: {
            permission: true
          }
        }
      }
    });

    if (!employee || employee.user.role !== Role.EMPLOYEE) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
    }

    return ok({ item: serializeEmployee(employee) });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, updateEmployeeActionSchema);
    const { id } = await context.params;

    const target = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            status: true
          }
        }
      }
    });
    if (!target || target.user.role !== Role.EMPLOYEE) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
    }

    let temporaryPassword: string | null = null;

    if (body.action === "suspend") {
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          status: UserStatus.SUSPENDED,
          isActive: false,
          suspendedAt: new Date(),
          suspensionReason: body.reason ?? null,
          suspendedByAdminId: actor.sub
        }
      });
    } else if (body.action === "activate") {
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          status: UserStatus.ACTIVE,
          isActive: true,
          suspendedAt: null,
          suspensionReason: null,
          suspendedByAdminId: null,
          bannedUntil: null,
          banReason: null,
          banMessage: null,
          bannedByAdminId: null
        }
      });
    } else if (body.action === "ban") {
      const bannedUntil = body.durationDays
        ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000)
        : null;
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          status: UserStatus.BANNED,
          isActive: false,
          bannedUntil,
          banReason: body.banReason ?? null,
          banMessage: body.banMessage ?? null,
          bannedByAdminId: actor.sub
        }
      });
    } else if (body.action === "unban") {
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          status: UserStatus.ACTIVE,
          isActive: true,
          bannedUntil: null,
          banReason: null,
          banMessage: null,
          bannedByAdminId: null
        }
      });
    } else if (body.action === "reset_password" || body.action === "resend_credentials") {
      temporaryPassword = generateTemporaryPassword();
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          passwordHash: await hashPassword(temporaryPassword),
          forcePasswordReset: true,
          mustChangePassword: true,
          lastPasswordChangeAt: null
        }
      });
    } else if (body.action === "force_password_reset") {
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          forcePasswordReset: true,
          mustChangePassword: true
        }
      });
    } else if (body.action === "update_permissions") {
      const uniquePermissions = Array.from(new Set(body.permissions));
      await prisma.$transaction([
        prisma.employeePermissionGrant.deleteMany({
          where: { employeeId: id }
        }),
        ...(uniquePermissions.length
          ? [
              prisma.employeePermissionGrant.createMany({
                data: uniquePermissions.map((permission) => ({
                  employeeId: id,
                  permission: appToDbPermission[permission]
                }))
              })
            ]
          : [])
      ]);
      await prisma.employee.update({
        where: { id },
        data: {
          permissionsUpdatedAt: new Date()
        }
      });
    } else {
      const data = body.data;
      const updateUserData: {
        fullName?: string;
      } = {};

      if (data.fullName) {
        updateUserData.fullName = data.fullName.trim();
      }

      const updateEmployeeData: {
        nationalIdHash?: string;
        nationalIdEncrypted?: string;
        birthDateEncrypted?: string;
        jobTitleEncrypted?: string;
        defaultSalaryEncrypted?: string;
        workScheduleEncrypted?: string;
        idCardImageUrl?: string;
        profilePhotoUrl?: string;
        jobTitle?: string;
      } = {};

      if (data.nationalId) {
        updateEmployeeData.nationalIdHash = createLookupHash(data.nationalId);
        updateEmployeeData.nationalIdEncrypted = encryptSensitive(data.nationalId);
      }
      if (data.birthDate) {
        updateEmployeeData.birthDateEncrypted = encryptSensitive(data.birthDate.toISOString());
      }
      if (data.jobTitle) {
        updateEmployeeData.jobTitleEncrypted = encryptSensitive(data.jobTitle);
        updateEmployeeData.jobTitle = data.jobTitle;
      }
      if (data.defaultSalaryInfo) {
        updateEmployeeData.defaultSalaryEncrypted = encryptSensitive(JSON.stringify(data.defaultSalaryInfo));
      }
      if (data.workSchedule) {
        updateEmployeeData.workScheduleEncrypted = encryptSensitive(JSON.stringify(data.workSchedule));
      }
      if (data.idCardImageUrl) {
        updateEmployeeData.idCardImageUrl = data.idCardImageUrl;
      }
      if (data.profilePhotoUrl) {
        updateEmployeeData.profilePhotoUrl = data.profilePhotoUrl;
      }

      await prisma.$transaction(async (tx) => {
        if (Object.keys(updateUserData).length) {
          await tx.user.update({
            where: { id: target.userId },
            data: updateUserData
          });
        }

        if (Object.keys(updateEmployeeData).length) {
          await tx.employee.update({
            where: { id },
            data: updateEmployeeData
          });
        }
      });
    }

    const refreshed = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            status: true,
            createdAt: true,
            bannedUntil: true,
            banReason: true,
            banMessage: true
          }
        },
        permissionGrants: {
          select: { permission: true }
        }
      }
    });

    if (!refreshed) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found after update.");
    }

    await logAudit({
      action: `EMPLOYEE_${body.action.toUpperCase()}`,
      entity: "Employee",
      entityId: id,
      actorId: actor.sub
    });

    return ok({
      item: serializeEmployee(refreshed),
      temporaryPassword
    });
  } catch (error) {
    return fail(error);
  }
}
