import { CustomerAccountEntryType, Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";
import { generateTemporaryPassword } from "@/lib/security";
import { normalizePhone } from "@/lib/utils/phone";

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
  phone: z
    .string()
    .trim()
    .transform((val) => normalizePhone(val) || val)
    .refine((val) => /^07\d{8}$/.test(val), "Phone must be a valid Jordan mobile number starting with 07 and contain 10 digits."),
  password: z.string().min(8).max(128).optional(),
  bio: z.string().max(280).optional(),
  carCompany: z.string().max(120).optional(),
  carType: z.string().max(120).optional(),
  carModel: z.string().max(100).optional(),
  carYear: z.string().max(10).optional(),
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

function computeLedgerStats(
  entries: Array<{ customerId: string; type: CustomerAccountEntryType; _sum: { amount: unknown }; _max: { occurredAt: Date | null } }>
) {
  const map = new Map<string, { balanceDue: number; totalPaid: number; totalServicesCost: number; lastLedgerDate: Date | null }>();
  for (const entry of entries) {
    const amount = Number(entry._sum.amount ?? 0);
    const current = map.get(entry.customerId) || { balanceDue: 0, totalPaid: 0, totalServicesCost: 0, lastLedgerDate: null };

    if (entry.type === CustomerAccountEntryType.PAYMENT) {
      current.balanceDue -= amount;
      current.totalPaid += amount;
    } else if (entry.type === CustomerAccountEntryType.CHARGE) {
      current.balanceDue += amount;
      current.totalServicesCost += amount;
    } else if (entry.type === CustomerAccountEntryType.ADJUSTMENT) {
      current.balanceDue += amount;
    }

    if (entry._max.occurredAt) {
      if (!current.lastLedgerDate || entry._max.occurredAt > current.lastLedgerDate) {
        current.lastLedgerDate = entry._max.occurredAt;
      }
    }

    map.set(entry.customerId, current);
  }
  return map;
}

function computeBookingStats(
  bookings: Array<{ customerId: string; status: string; _count: { _all: number }; _max: { createdAt: Date | null } }>
) {
  const map = new Map<string, { totalBookings: number; completedJobs: number; lastBookingDate: Date | null }>();
  for (const b of bookings) {
    const current = map.get(b.customerId) || { totalBookings: 0, completedJobs: 0, lastBookingDate: null };
    current.totalBookings += b._count._all;

    if (b.status === "COMPLETED") {
      current.completedJobs += b._count._all;
    }

    if (b._max.createdAt) {
      if (!current.lastBookingDate || b._max.createdAt > current.lastBookingDate) {
        current.lastBookingDate = b._max.createdAt;
      }
    }

    map.set(b.customerId, current);
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
          { fullName: { contains: query.q } },
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

    // Aggregate Ledger
    const entries = customerIds.length
      ? await prisma.customerAccountEntry.groupBy({
        by: ["customerId", "type"],
        where: { customerId: { in: customerIds } },
        _sum: { amount: true },
        _max: { occurredAt: true }
      })
      : [];
    const ledgerStats = computeLedgerStats(entries);

    // Aggregate Bookings
    const bookings = customerIds.length
      ? await prisma.booking.groupBy({
        by: ["customerId", "status"],
        where: { customerId: { in: customerIds } },
        _count: { _all: true },
        _max: { createdAt: true }
      })
      : [];
    const bookingStats = computeBookingStats(bookings);

    return ok({
      items: users.map((user) => {
        const lStat = ledgerStats.get(user.id) || { balanceDue: 0, totalPaid: 0, totalServicesCost: 0, lastLedgerDate: null };
        const bStat = bookingStats.get(user.id) || { totalBookings: 0, completedJobs: 0, lastBookingDate: null };

        let lastActivityDate = lStat.lastLedgerDate;
        if (bStat.lastBookingDate) {
          if (!lastActivityDate || bStat.lastBookingDate > lastActivityDate) {
            lastActivityDate = bStat.lastBookingDate;
          }
        }

        return {
          id: user.id,
          avatar: user.avatarUrl,
          fullName: user.fullName,
          phone: user.phone,
          joinedAt: user.createdAt,
          status: user.status.toLowerCase(),
          bannedUntil: user.bannedUntil,
          balanceDue: Number(lStat.balanceDue.toFixed(2)),
          totalPaid: Number(lStat.totalPaid.toFixed(2)),
          totalServicesCost: Number(lStat.totalServicesCost.toFixed(2)),
          totalBookings: bStat.totalBookings,
          completedJobs: bStat.completedJobs,
          lastActivityDate
        };
      }),
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

    // Zod already normalized the phone via the transform.
    const normalizedPhone = body.phone;
    const existing = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true, fullName: true, phone: true }
    });
    if (existing) {
      // Safe error that admin can see
      throw new ApiError(409, "PHONE_ALREADY_EXISTS", `Phone already exists (${existing.fullName || existing.phone}).`);
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
          carCompany: body.carCompany,
          carType: body.carType,
          carModel: body.carModel,
          carYear: body.carYear,
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
