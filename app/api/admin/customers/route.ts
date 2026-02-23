import { CustomerAccountEntryType, Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";
import { generateTemporaryPassword } from "@/lib/security";

const listCustomersQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["active", "suspended", "banned"]).optional(),
  joinFrom: z.coerce.date().optional(),
  joinTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const createCustomerSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(128).optional(),
  bio: z.string().max(280).optional(),
  carType: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  avatarUrl: z.string().max(1000).optional(),
  initialDebt: z.coerce.number().min(0).optional(),
  initialDebtNote: z.string().max(500).optional(),
  initialPayment: z.coerce.number().min(0).optional()
});

function toUserStatusFilter(value: "active" | "suspended" | "banned" | undefined): UserStatus | undefined {
  if (!value) return undefined;
  if (value === "active") return UserStatus.ACTIVE;
  if (value === "suspended") return UserStatus.SUSPENDED;
  return UserStatus.BANNED;
}

function computeBalanceDue(
  entries: Array<{ customerId: string; type: CustomerAccountEntryType; amount: unknown }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const amount = Number(entry.amount);
    const current = map.get(entry.customerId) ?? 0;
    if (entry.type === CustomerAccountEntryType.PAYMENT) {
      map.set(entry.customerId, current - amount);
    } else {
      map.set(entry.customerId, current + amount);
    }
  }
  return map;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["bookings", "accounting"]);
    }

    const url = new URL(request.url);
    const query = await listCustomersQuerySchema.parseAsync({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      joinFrom: url.searchParams.get("joinFrom") ?? undefined,
      joinTo: url.searchParams.get("joinTo") ?? undefined,
      page: url.searchParams.get("page") ?? "1",
      limit: url.searchParams.get("limit") ?? "20"
    });

    const where = {
      role: Role.CUSTOMER,
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
    };

    const skip = (query.page - 1) * query.limit;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
        select: {
          id: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          createdAt: true,
          status: true,
          bannedUntil: true
        }
      })
    ]);

    const customerIds = users.map((item) => item.id);
    const entries = customerIds.length
      ? await prisma.customerAccountEntry.findMany({
          where: { customerId: { in: customerIds } },
          select: { customerId: true, type: true, amount: true }
        })
      : [];
    const balanceMap = computeBalanceDue(entries);

    return ok({
      items: users.map((user) => ({
        id: user.id,
        avatar: user.avatarUrl,
        fullName: user.fullName,
        phone: user.phone,
        joinedAt: user.createdAt,
        status: user.status.toLowerCase(),
        bannedUntil: user.bannedUntil,
        balanceDue: Number((balanceMap.get(user.id) ?? 0).toFixed(2))
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
    const body = await parseJsonBody(request, createCustomerSchema);

    const normalizedPhone = body.phone.trim();
    const existing = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true }
    });
    if (existing) {
      throw new ApiError(409, "PHONE_ALREADY_EXISTS", "Phone already exists.");
    }

    const temporaryPassword = body.password ? null : generateTemporaryPassword();
    const password = body.password ?? temporaryPassword!;

    const item = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: Role.CUSTOMER,
          fullName: body.fullName.trim(),
          phone: normalizedPhone,
          passwordHash: await hashPassword(password),
          bio: body.bio,
          carType: body.carType,
          location: body.location,
          avatarUrl: body.avatarUrl
        }
      });

      if (body.initialDebt && body.initialDebt > 0) {
        await tx.customerAccountEntry.create({
          data: {
            customerId: user.id,
            type: CustomerAccountEntryType.CHARGE,
            amount: body.initialDebt,
            note: body.initialDebtNote || "Initial debt",
            createdByAdminId: actor.sub
          }
        });
      }

      if (body.initialPayment && body.initialPayment > 0) {
        await tx.customerAccountEntry.create({
          data: {
            customerId: user.id,
            type: CustomerAccountEntryType.PAYMENT,
            amount: body.initialPayment,
            note: "Initial payment",
            createdByAdminId: actor.sub
          }
        });
      }

      return user;
    });

    await logAudit({
      action: "CUSTOMER_CREATE",
      entity: "User",
      entityId: item.id,
      actorId: actor.sub
    });

    return ok(
      {
        item: {
          id: item.id,
          fullName: item.fullName,
          phone: item.phone,
          joinedAt: item.createdAt,
          status: item.status.toLowerCase()
        },
        temporaryPassword
      },
      201
    );
  } catch (error) {
    return fail(error);
  }
}

