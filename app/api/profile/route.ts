import { Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import {
  buildEmployeeActivity,
  buildEmployeeAttendance,
  buildEmployeePerformance,
  effectiveOverrides,
  getEmployeeStatusLabel,
  resolvePerformanceRange
} from "@/lib/employee-profile";
import { prisma } from "@/lib/prisma";
import { getPermissionsForUser, requireSession } from "@/lib/rbac";
import { decryptSensitive } from "@/lib/security";
import { normalizePhone } from "@/lib/utils/phone";

const profileUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_profile"),
    fullName: z.string().min(2).max(120).optional(),
    phone: z
      .string()
      .trim()
      .transform((val) => normalizePhone(val) || val)
      .refine((val) => /^07\d{8}$/.test(val), "Phone must be a valid Jordan mobile number starting with 07 and contain 10 digits.")
      .optional(),
    bio: z.string().max(280).nullable().optional(),
    carCompany: z.string().max(120).nullable().optional(),
    carType: z.string().max(120).nullable().optional(),
    location: z.string().max(120).nullable().optional(),
    governorate: z.string().max(100).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    carModel: z.string().max(100).nullable().optional(),
    carYear: z.string().max(10).nullable().optional(),
    licensePlate: z.string().max(50).nullable().optional(),
    preferredContact: z.enum(["CALL", "WHATSAPP"]).nullable().optional(),
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

function decryptMaybe(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return decryptSensitive(value);
  } catch {
    return null;
  }
}

function parseDecryptedJson(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: Request): Promise<Response> {
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
    const url = new URL(request.url);
    const performanceRange = resolvePerformanceRange(url.searchParams.get("from"), url.searchParams.get("to"));
    const activityFrom = url.searchParams.get("activityFrom");
    const activityTo = url.searchParams.get("activityTo");
    const attendanceFrom = url.searchParams.get("attendanceFrom");
    const attendanceTo = url.searchParams.get("attendanceTo");
    const activityRange = activityFrom || activityTo ? resolvePerformanceRange(activityFrom, activityTo) : undefined;
    const attendanceRange = attendanceFrom || attendanceTo ? resolvePerformanceRange(attendanceFrom, attendanceTo) : undefined;
    const employeeExtras =
      user.role === Role.EMPLOYEE && user.employeeProfile
        ? await Promise.all([
          buildEmployeePerformance(user.employeeProfile.id, user.id, user.employeeProfile.roleProfile, performanceRange),
          buildEmployeeActivity(user.id, user.employeeProfile.id, activityRange),
          buildEmployeeAttendance(user.employeeProfile.id, attendanceRange)
        ])
        : null;

    return ok({
      user: {
        id: user.id,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        bio: user.bio,
        carCompany: user.carCompany,
        carType: user.carType,
        location: user.location,
        governorate: user.governorate,
        city: user.city,
        address: user.address,
        carModel: user.carModel,
        carYear: user.carYear,
        licensePlate: user.licensePlate,
        preferredContact: user.preferredContact,
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
              id: user.employeeProfile.id,
              nationalId: decryptMaybe(user.employeeProfile.nationalIdEncrypted),
              birthDate: decryptMaybe(user.employeeProfile.birthDateEncrypted),
              jobTitle: decryptMaybe(user.employeeProfile.jobTitleEncrypted) ?? user.employeeProfile.jobTitle ?? null,
              defaultSalaryInfo: parseDecryptedJson(decryptMaybe(user.employeeProfile.defaultSalaryEncrypted)),
              workSchedule: parseDecryptedJson(decryptMaybe(user.employeeProfile.workScheduleEncrypted)),
              idCardImageUrl: user.employeeProfile.idCardImageUrl,
              profilePhotoUrl: user.employeeProfile.profilePhotoUrl,
              roleProfile: user.employeeProfile.roleProfile,
              department: user.employeeProfile.department,
              employmentType: user.employeeProfile.employmentType,
              employmentStatus: getEmployeeStatusLabel(user.status, user.employeeProfile.employmentStatus),
              suspendedUntil: user.status === "SUSPENDED" ? user.bannedUntil : null,
              bannedUntil: user.bannedUntil,
              startDate: user.employeeProfile.startDate ?? user.employeeProfile.hiredAt,
              emergencyContact: user.employeeProfile.emergencyContact,
              address: user.employeeProfile.address || user.address,
              paymentFrequency: user.employeeProfile.paymentFrequency,
              salary: user.employeeProfile.monthlyBase ? Number(user.employeeProfile.monthlyBase) : null,
              bonusHistory: Array.isArray(user.employeeProfile.bonusHistory) ? user.employeeProfile.bonusHistory : [],
              deductions: Array.isArray(user.employeeProfile.deductions) ? user.employeeProfile.deductions : [],
              leaveBalance:
                user.employeeProfile.leaveBalance &&
                  typeof user.employeeProfile.leaveBalance === "object" &&
                  !Array.isArray(user.employeeProfile.leaveBalance)
                  ? user.employeeProfile.leaveBalance
                  : { annual: 0, sick: 0 },
              internalNotes: user.employeeProfile.internalNotes,
              permissionOverrides: effectiveOverrides(
                user.employeeProfile.roleProfile,
                user.employeeProfile.permissionOverrides
              ),
              performance: employeeExtras?.[0] ?? null,
              security: employeeExtras?.[1].security ?? null,
              recentActivity: employeeExtras?.[1].recentActivity ?? [],
              activityLog: employeeExtras?.[1].activity ?? [],
              sessions: employeeExtras?.[1].sessions ?? [],
              attendance: employeeExtras?.[2] ?? { snapshot: { lastCheckInAt: null, lastCheckOutAt: null }, log: [], monthlySummary: null }
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
          carCompany: body.carCompany,
          carType: body.carType,
          location: body.location,
          governorate: body.governorate,
          city: body.city,
          address: body.address,
          carModel: body.carModel,
          carYear: body.carYear,
          licensePlate: body.licensePlate,
          preferredContact: body.preferredContact,
          avatarUrl: body.avatarUrl
        }
      });
    } else if (user.role === Role.EMPLOYEE) {
      const nextPhone = body.phone; // already normalized by zod
      if (nextPhone && nextPhone !== session.phone) {
        const existing = await prisma.user.findUnique({
          where: { phone: nextPhone },
          select: { id: true }
        });
        if (existing && existing.id !== user.id) {
          throw new ApiError(409, "PHONE_ALREADY_EXISTS", "Phone already exists.");
        }
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            fullName: body.fullName,
            phone: nextPhone,
            avatarUrl: body.avatarUrl
          }
        }),
        prisma.employee.update({
          where: { userId: user.id },
          data: {
            profilePhotoUrl: body.avatarUrl
          }
        })
      ]);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: body.fullName,
          phone: body.phone,
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
