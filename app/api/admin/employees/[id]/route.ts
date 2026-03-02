import { EmploymentStatus, Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import {
  buildEmployeeActivity,
  buildEmployeeAttendance,
  buildEmployeePerformance,
  effectiveOverrides,
  getEmployeeStatusLabel,
  resolvePerformanceRange
} from "@/lib/employee-profile";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appToDbPermission, requireRoles } from "@/lib/rbac";
import { createLookupHash, decryptSensitive, encryptSensitive, generateTemporaryPassword } from "@/lib/security";
import {
  employeeHrAdminUpdateSchema,
  employeePermissionOverrideSchema,
  employeePermissionsUpdateSchema,
  employeeProfileUpdateSchema
} from "@/lib/validators/employee";

const updateEmployeeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    durationDays: z.coerce.number().int().min(1).max(365).optional(),
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
    action: z.literal("force_logout_all")
  }),
  z.object({
    action: z.literal("update_profile"),
    data: employeeProfileUpdateSchema
  }),
  z.object({
    action: z.literal("update_permissions"),
    permissions: z.array(z.enum(["accounting", "warehouse", "bookings", "hr", "memberships", "analytics", "services"])).default([])
  }),
  z.object({
    action: z.literal("update_role_permissions"),
    data: employeePermissionsUpdateSchema
  }),
  z.object({
    action: z.literal("update_hr"),
    data: employeeHrAdminUpdateSchema.extend({
      fullName: z.string().min(2).max(120).optional(),
      nationalId: z.string().min(6).max(64).optional(),
      birthDate: z.coerce.date().optional(),
      jobTitle: z.string().min(2).max(120).optional(),
      avatarUrl: z.string().max(1000).nullable().optional()
    })
  })
]);

type Params = { params: Promise<{ id: string }> };

function decryptMaybe(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptSensitive(value);
  } catch {
    return null;
  }
}

function parseJsonArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toLegacyPermissions(overrides: ReturnType<typeof employeePermissionOverrideSchema.parse>): Array<keyof typeof appToDbPermission> {
  const permissions: Array<keyof typeof appToDbPermission> = [];
  if (overrides.canManageBookings) permissions.push("bookings");
  if (overrides.canAccessAccounting) permissions.push("accounting");
  if (overrides.canEditInventory) permissions.push("warehouse");
  if (overrides.canManageEmployees) permissions.push("hr");
  if (overrides.canViewReports) permissions.push("analytics");
  return permissions;
}

async function loadEmployeeProfile(
  id: string,
  performanceFrom?: string | null,
  performanceTo?: string | null,
  activityFrom?: string | null,
  activityTo?: string | null,
  attendanceFrom?: string | null,
  attendanceTo?: string | null
) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: true,
      permissionGrants: { select: { permission: true } }
    }
  });

  if (!employee || employee.user.role !== Role.EMPLOYEE) {
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  const performanceRange = resolvePerformanceRange(performanceFrom, performanceTo);
  const activityRange = activityFrom || activityTo ? resolvePerformanceRange(activityFrom, activityTo) : undefined;
  const attendanceRange = attendanceFrom || attendanceTo ? resolvePerformanceRange(attendanceFrom, attendanceTo) : undefined;
  const [performance, activityBundle, attendance] = await Promise.all([
    buildEmployeePerformance(employee.id, employee.userId, employee.roleProfile, performanceRange),
    buildEmployeeActivity(employee.userId, employee.id, activityRange),
    buildEmployeeAttendance(employee.id, attendanceRange)
  ]);

  const overrides = effectiveOverrides(employee.roleProfile, employee.permissionOverrides);
  const leaveBalance = parseJsonObject(employee.leaveBalance) ?? { annual: 0, sick: 0 };

  return {
    id: employee.id,
    userId: employee.userId,
    fullName: employee.user.fullName,
    phone: employee.user.phone,
    joinedAt: employee.user.createdAt.toISOString(),
    roleProfile: employee.roleProfile,
    status: getEmployeeStatusLabel(employee.user.status, employee.employmentStatus),
    accountStatus: employee.user.status,
    employmentStatus: employee.employmentStatus,
    suspendedUntil: employee.user.status === UserStatus.SUSPENDED ? employee.user.bannedUntil?.toISOString() ?? null : null,
    bannedUntil: employee.user.bannedUntil?.toISOString() ?? null,
    banReason: employee.user.banReason,
    banMessage: employee.user.banMessage,
    avatar: employee.profilePhotoUrl || employee.user.avatarUrl,
    profile: {
      avatar: employee.profilePhotoUrl || employee.user.avatarUrl,
      fullName: employee.user.fullName,
      phone: employee.user.phone,
      jobTitle: decryptMaybe(employee.jobTitleEncrypted) ?? employee.jobTitle,
      department: employee.department,
      employmentType: employee.employmentType,
      startDate: employee.startDate?.toISOString() ?? employee.hiredAt.toISOString(),
      emergencyContact: employee.emergencyContact,
      address: employee.address || employee.user.address,
      status: getEmployeeStatusLabel(employee.user.status, employee.employmentStatus)
    },
    permissions: {
      roleProfile: employee.roleProfile,
      overrides,
      legacyPermissions: employee.permissionGrants.map((entry) => entry.permission.toLowerCase())
    },
    performance,
    security: activityBundle.security,
    recentActivity: activityBundle.recentActivity,
    activityLog: activityBundle.activity,
    sessions: activityBundle.sessions,
    attendance,
    hr: {
      nationalId: decryptMaybe(employee.nationalIdEncrypted),
      birthDate: decryptMaybe(employee.birthDateEncrypted),
      jobTitle: decryptMaybe(employee.jobTitleEncrypted) ?? employee.jobTitle,
      salary: employee.monthlyBase ? Number(employee.monthlyBase) : null,
      paymentFrequency: employee.paymentFrequency,
      bonusHistory: parseJsonArray(employee.bonusHistory),
      deductions: parseJsonArray(employee.deductions),
      leaveBalance,
      internalNotes: employee.internalNotes,
      idCardImageUrl: employee.idCardImageUrl,
      profilePhotoUrl: employee.profilePhotoUrl
    }
  };
}

export async function GET(request: Request, context: Params): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const { id } = await context.params;
    const url = new URL(request.url);
    const item = await loadEmployeeProfile(
      id,
      url.searchParams.get("from"),
      url.searchParams.get("to"),
      url.searchParams.get("activityFrom"),
      url.searchParams.get("activityTo"),
      url.searchParams.get("attendanceFrom"),
      url.searchParams.get("attendanceTo")
    );
    return ok({ item });
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
            phone: true,
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
      const suspendedUntil = body.durationDays ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          status: UserStatus.SUSPENDED,
          isActive: false,
          suspendedAt: new Date(),
          suspensionReason: body.reason ?? null,
          suspendedByAdminId: actor.sub,
          bannedUntil: suspendedUntil
        }
      });
    } else if (body.action === "activate" || body.action === "unban") {
      await prisma.$transaction([
        prisma.user.update({
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
        }),
        prisma.employee.update({
          where: { id },
          data: { employmentStatus: EmploymentStatus.ACTIVE }
        })
      ]);
    } else if (body.action === "ban") {
      const bannedUntil = body.durationDays ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000) : null;
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
    } else if (body.action === "force_logout_all") {
      await prisma.user.update({
        where: { id: target.userId },
        data: {
          sessionVersion: { increment: 1 }
        }
      });
    } else if (body.action === "update_profile") {
      const data = body.data;

      if (data.phone && data.phone !== target.user.phone) {
        const existingUser = await prisma.user.findUnique({
          where: { phone: data.phone },
          select: { id: true }
        });
        if (existingUser && existingUser.id !== target.userId) {
          throw new ApiError(409, "PHONE_ALREADY_EXISTS", "Phone already exists.");
        }
      }

      const userData: {
        fullName?: string;
        phone?: string;
        avatarUrl?: string | null;
        status?: UserStatus;
        isActive?: boolean;
        bannedUntil?: Date | null;
      } = {};
      const employeeData: {
        jobTitleEncrypted?: string;
        jobTitle?: string;
        department?: string | null;
        employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT";
        startDate?: Date | null;
        emergencyContact?: string | null;
        address?: string | null;
        profilePhotoUrl?: string | null;
        employmentStatus?: EmploymentStatus;
      } = {};

      if (data.fullName) userData.fullName = data.fullName.trim();
      if (data.phone) userData.phone = data.phone.trim();
      if (typeof data.avatarUrl !== "undefined") {
        userData.avatarUrl = data.avatarUrl;
        employeeData.profilePhotoUrl = data.avatarUrl;
      }
      if (data.jobTitle) {
        employeeData.jobTitle = data.jobTitle;
        employeeData.jobTitleEncrypted = encryptSensitive(data.jobTitle);
      }
      if (typeof data.department !== "undefined") employeeData.department = data.department;
      if (data.employmentType) employeeData.employmentType = data.employmentType;
      if (typeof data.startDate !== "undefined") employeeData.startDate = data.startDate;
      if (typeof data.emergencyContact !== "undefined") employeeData.emergencyContact = data.emergencyContact;
      if (typeof data.address !== "undefined") employeeData.address = data.address;

      if (data.status === "ON_LEAVE") {
        employeeData.employmentStatus = EmploymentStatus.ON_LEAVE;
        userData.status = UserStatus.ACTIVE;
        userData.isActive = true;
        userData.bannedUntil = null;
      } else if (data.status === "ACTIVE") {
        employeeData.employmentStatus = EmploymentStatus.ACTIVE;
        userData.status = UserStatus.ACTIVE;
        userData.isActive = true;
        userData.bannedUntil = null;
      } else if (data.status === "SUSPENDED") {
        employeeData.employmentStatus = EmploymentStatus.ACTIVE;
        userData.status = UserStatus.SUSPENDED;
        userData.isActive = false;
      } else if (data.status === "BANNED") {
        employeeData.employmentStatus = EmploymentStatus.ACTIVE;
        userData.status = UserStatus.BANNED;
        userData.isActive = false;
      }

      await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length) {
          await tx.user.update({ where: { id: target.userId }, data: userData });
        }
        if (Object.keys(employeeData).length) {
          await tx.employee.update({ where: { id }, data: employeeData });
        }
      });
    } else if (body.action === "update_permissions") {
      const uniquePermissions = Array.from(new Set(body.permissions));
      await prisma.$transaction([
        prisma.employeePermissionGrant.deleteMany({ where: { employeeId: id } }),
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
    } else if (body.action === "update_role_permissions") {
      const roleProfile = body.data.roleProfile;
      const overrides = body.data.overrides;
      const legacyPermissions = toLegacyPermissions(overrides);

      await prisma.$transaction([
        prisma.employee.update({
          where: { id },
          data: {
            roleProfile,
            permissionOverrides: overrides,
            permissionsUpdatedAt: new Date()
          }
        }),
        prisma.employeePermissionGrant.deleteMany({ where: { employeeId: id } }),
        ...(legacyPermissions.length
          ? [
              prisma.employeePermissionGrant.createMany({
                data: legacyPermissions.map((permission) => ({
                  employeeId: id,
                  permission: appToDbPermission[permission]
                }))
              })
            ]
          : [])
      ]);
    } else {
      const data = body.data;
      const userData: { fullName?: string; avatarUrl?: string | null } = {};
      const employeeData: Record<string, unknown> = {};

      if (data.fullName) userData.fullName = data.fullName.trim();
      if (data.nationalId) {
        employeeData.nationalIdHash = createLookupHash(data.nationalId);
        employeeData.nationalIdEncrypted = encryptSensitive(data.nationalId);
      }
      if (data.birthDate) {
        employeeData.birthDateEncrypted = encryptSensitive(data.birthDate.toISOString());
      }
      if (data.jobTitle) {
        employeeData.jobTitle = data.jobTitle;
        employeeData.jobTitleEncrypted = encryptSensitive(data.jobTitle);
      }
      if (typeof data.avatarUrl !== "undefined") {
        userData.avatarUrl = data.avatarUrl;
        employeeData.profilePhotoUrl = data.avatarUrl;
      }
      if (typeof data.salary !== "undefined") employeeData.monthlyBase = data.salary;
      if (typeof data.paymentFrequency !== "undefined") employeeData.paymentFrequency = data.paymentFrequency;
      if (typeof data.bonusHistory !== "undefined") employeeData.bonusHistory = data.bonusHistory;
      if (typeof data.deductions !== "undefined") employeeData.deductions = data.deductions;
      if (typeof data.leaveBalance !== "undefined") employeeData.leaveBalance = data.leaveBalance;
      if (typeof data.internalNotes !== "undefined") employeeData.internalNotes = data.internalNotes;

      await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length) {
          await tx.user.update({ where: { id: target.userId }, data: userData });
        }
        if (Object.keys(employeeData).length) {
          await tx.employee.update({ where: { id }, data: employeeData });
        }
      });
    }

    await logAudit({
      action: `EMPLOYEE_${body.action.toUpperCase()}`,
      entity: "Employee",
      entityId: id,
      actorId: actor.sub
    });

    const item = await loadEmployeeProfile(id);
    return ok({ item, temporaryPassword });
  } catch (error) {
    return fail(error);
  }
}
