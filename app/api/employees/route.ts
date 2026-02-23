import { Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appToDbPermission, requireAnyPermission, requireRoles } from "@/lib/rbac";
import { createLookupHash, encryptSensitive, generateTemporaryPassword } from "@/lib/security";
import { createEmployeeSchema } from "@/lib/validators/employee";

function ensureFourPartName(value: string): void {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length !== 4) {
    throw new ApiError(400, "INVALID_FULL_NAME", "fullName must contain exactly 4 parts.");
  }
}

export async function GET(): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["hr"]);
    }

    const items = await prisma.employee.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
            isActive: true,
            createdAt: true,
            avatarUrl: true
          }
        },
        permissionGrants: {
          select: { permission: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return ok({
      items: items.map((employee) => ({
        id: employee.id,
        userId: employee.userId,
        fullName: employee.user.fullName,
        phone: employee.user.phone,
        joinedAt: employee.user.createdAt,
        status: employee.user.status,
        isActive: employee.user.isActive,
        avatarUrl: employee.profilePhotoUrl || employee.user.avatarUrl,
        permissions: employee.permissionGrants.map((entry) => entry.permission.toLowerCase())
      }))
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, createEmployeeSchema);
    ensureFourPartName(body.fullName);

    const normalizedPhone = body.phone.trim();
    const nationalIdHash = createLookupHash(body.nationalId);

    const [phoneOwner, nationalIdOwner] = await Promise.all([
      prisma.user.findUnique({ where: { phone: normalizedPhone }, select: { id: true } }),
      prisma.employee.findUnique({ where: { nationalIdHash }, select: { id: true } })
    ]);

    if (phoneOwner) {
      throw new ApiError(409, "PHONE_ALREADY_EXISTS", "Phone already exists.");
    }

    if (nationalIdOwner) {
      throw new ApiError(409, "NATIONAL_ID_ALREADY_EXISTS", "National ID already exists.");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const uniquePermissions = Array.from(new Set(body.permissions));

    const item = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: normalizedPhone,
          passwordHash,
          fullName: body.fullName.trim(),
          role: Role.EMPLOYEE,
          mustChangePassword: true,
          forcePasswordReset: true
        }
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          createdByAdminId: actor.sub,
          nationalIdHash,
          nationalIdEncrypted: encryptSensitive(body.nationalId),
          birthDateEncrypted: encryptSensitive(body.birthDate.toISOString()),
          jobTitleEncrypted: encryptSensitive(body.jobTitle),
          defaultSalaryEncrypted: encryptSensitive(JSON.stringify(body.defaultSalaryInfo)),
          workScheduleEncrypted: encryptSensitive(JSON.stringify(body.workSchedule)),
          idCardImageUrl: body.idCardImageUrl,
          profilePhotoUrl: body.profilePhotoUrl,
          jobTitle: body.jobTitle,
          monthlyBase:
            typeof body.defaultSalaryInfo.monthlyBase === "number"
              ? body.defaultSalaryInfo.monthlyBase
              : undefined,
          permissionGrants: uniquePermissions.length
            ? {
                createMany: {
                  data: uniquePermissions.map((permission) => ({
                    permission: appToDbPermission[permission]
                  }))
                }
              }
            : undefined
        },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              fullName: true,
              role: true,
              createdAt: true,
              status: true
            }
          },
          permissionGrants: {
            select: { permission: true }
          }
        }
      });

      return employee;
    });

    await logAudit({
      action: "EMPLOYEE_CREATE",
      entity: "Employee",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        userId: item.userId,
        permissions: item.permissionGrants.map((entry) => entry.permission)
      }
    });

    return ok(
      {
        item: {
          id: item.id,
          userId: item.userId,
          fullName: item.user.fullName,
          phone: item.user.phone,
          joinedAt: item.user.createdAt,
          status: item.user.status,
          permissions: item.permissionGrants.map((entry) => entry.permission.toLowerCase()),
          temporaryPassword,
          mustChangePassword: true
        }
      },
      201
    );
  } catch (error) {
    return fail(error);
  }
}

