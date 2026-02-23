import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appToDbPermission, requireRoles } from "@/lib/rbac";
import { createLookupHash, encryptSensitive, generateTemporaryPassword } from "@/lib/security";
import { createEmployeeSchema } from "@/lib/validators/employee";

const listEmployeesQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["active", "suspended", "banned"]).optional(),
  joinFrom: z.coerce.date().optional(),
  joinTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

function toUserStatusFilter(value: "active" | "suspended" | "banned" | undefined): UserStatus | undefined {
  if (!value) return undefined;
  if (value === "active") return UserStatus.ACTIVE;
  if (value === "suspended") return UserStatus.SUSPENDED;
  return UserStatus.BANNED;
}

function ensureFourPartName(value: string): void {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length !== 4) {
    throw new ApiError(400, "INVALID_FULL_NAME", "fullName must contain exactly 4 parts.");
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);

    const url = new URL(request.url);
    const query = await listEmployeesQuerySchema.parseAsync({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      joinFrom: url.searchParams.get("joinFrom") ?? undefined,
      joinTo: url.searchParams.get("joinTo") ?? undefined,
      page: url.searchParams.get("page") ?? "1",
      limit: url.searchParams.get("limit") ?? "20"
    });

    const where = {
      user: {
        role: Role.EMPLOYEE,
        status: toUserStatusFilter(query.status),
        OR: query.q
          ? [
              { fullName: { contains: query.q, mode: "insensitive" as const } },
              { phone: { contains: query.q } }
            ]
          : undefined,
        createdAt:
          query.joinFrom || query.joinTo
            ? {
                gte: query.joinFrom,
                lte: query.joinTo
              }
            : undefined
      }
    };

    const skip = (query.page - 1) * query.limit;

    const [total, items] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              status: true,
              avatarUrl: true,
              createdAt: true,
              bannedUntil: true
            }
          },
          permissionGrants: {
            select: { permission: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit
      })
    ]);

    return ok({
      items: items.map((employee) => ({
        id: employee.id,
        userId: employee.userId,
        avatar: employee.profilePhotoUrl || employee.user.avatarUrl,
        fullName: employee.user.fullName,
        phone: employee.user.phone,
        joinedAt: employee.user.createdAt,
        status: employee.user.status.toLowerCase(),
        bannedUntil: employee.user.bannedUntil,
        permissions: employee.permissionGrants.map((entry) => entry.permission.toLowerCase())
      })),
      page: query.page,
      limit: query.limit,
      total
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
      prisma.user.findUnique({
        where: { phone: normalizedPhone },
        select: { id: true }
      }),
      prisma.employee.findUnique({
        where: { nationalIdHash },
        select: { id: true }
      })
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

    const employee = await prisma.$transaction(async (tx) => {
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

      return tx.employee.create({
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
              fullName: true,
              phone: true,
              createdAt: true,
              status: true
            }
          },
          permissionGrants: {
            select: { permission: true }
          }
        }
      });
    });

    await logAudit({
      action: "EMPLOYEE_CREATE",
      entity: "Employee",
      entityId: employee.id,
      actorId: actor.sub,
      payload: {
        userId: employee.userId,
        permissions: employee.permissionGrants.map((entry) => entry.permission)
      }
    });

    return ok(
      {
        item: {
          id: employee.id,
          userId: employee.userId,
          fullName: employee.user.fullName,
          phone: employee.user.phone,
          joinedAt: employee.user.createdAt,
          status: employee.user.status.toLowerCase(),
          permissions: employee.permissionGrants.map((entry) => entry.permission.toLowerCase()),
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

