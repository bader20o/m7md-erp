import { CustomerAccountEntryType, CustomerRewardStatus, Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";
import { generateTemporaryPassword } from "@/lib/security";

const updateCustomerSchema = z.discriminatedUnion("action", [
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
    action: z.literal("force_password_reset")
  }),
  z.object({
    action: z.literal("update_profile"),
    fullName: z.string().min(2).max(120).optional(),
    bio: z.string().max(280).nullable().optional(),
    carType: z.string().max(120).nullable().optional(),
    carCompany: z.string().max(120).nullable().optional(),
    carModel: z.string().max(100).nullable().optional(),
    carYear: z.string().max(10).nullable().optional(),
    location: z.string().max(120).nullable().optional(),
    avatarUrl: z.string().max(1000).nullable().optional()
  })
]);

type Params = { params: Promise<{ id: string }> };

function computeBalanceDue(entries: Array<{ type: CustomerAccountEntryType; amount: unknown }>): number {
  return Number(
    entries
      .reduce((sum, entry) => {
        const amount = Number(entry.amount);
        if (entry.type === CustomerAccountEntryType.PAYMENT) {
          return sum - amount;
        }
        return sum + amount;
      }, 0)
      .toFixed(2)
  );
}

export async function GET(_: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["bookings", "accounting"]);
    }

    const { id } = await context.params;
    const customer = await prisma.user.findFirst({
      where: {
        id,
        role: Role.CUSTOMER
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        bio: true,
        carCompany: true,
        carType: true,
        carModel: true,
        carYear: true,
        location: true,
        avatarUrl: true,
        createdAt: true,
        bannedUntil: true,
        banReason: true,
        banMessage: true,
        customerLedgerEntries: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: 200,
          select: {
            id: true,
            type: true,
            amount: true,
            occurredAt: true,
            note: true,
            createdAt: true,
            referenceType: true,
            referenceId: true,
            createdByAdmin: {
              select: {
                id: true,
                fullName: true,
                phone: true
              }
            }
          }
        },
        customerBookings: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            status: true,
            finalPrice: true,
            createdAt: true,
            appointmentAt: true,
            serviceNameSnapshotEn: true
          }
        }
      }
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    const balanceDue = computeBalanceDue(customer.customerLedgerEntries);

    const [totalValidVisits, completedServicesCount, progressRows, availableRewards, rewardHistory] = await Promise.all([
      prisma.customerVisit.count({ where: { customerId: customer.id } }),
      prisma.booking.count({ where: { customerId: customer.id, status: "COMPLETED" } }),
      prisma.customerRewardProgress.findMany({
        where: { customerId: customer.id },
        include: {
          rewardRule: {
            select: {
              id: true,
              title: true,
              triggerType: true,
              triggerValue: true,
              rewardType: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.customerReward.findMany({
        where: { customerId: customer.id, status: CustomerRewardStatus.AVAILABLE },
        include: {
          rewardRule: { select: { id: true, title: true, rewardType: true } },
          rewardService: { select: { id: true, nameEn: true, nameAr: true } }
        },
        orderBy: { issuedAt: "desc" },
        take: 30
      }),
      prisma.customerReward.findMany({
        where: {
          customerId: customer.id,
          status: { in: [CustomerRewardStatus.REDEEMED, CustomerRewardStatus.EXPIRED, CustomerRewardStatus.CANCELLED] }
        },
        include: {
          rewardRule: { select: { id: true, title: true, rewardType: true } },
          rewardService: { select: { id: true, nameEn: true, nameAr: true } }
        },
        orderBy: { updatedAt: "desc" },
        take: 40
      })
    ]);

    return ok({
      item: {
        ...customer,
        joinedAt: customer.createdAt,
        status: customer.status.toLowerCase(),
        balanceDue,
        loyalty: {
          totalValidVisits,
          completedServicesCount,
          progress: progressRows.map((row) => ({
            id: row.id,
            progressValue: row.progressValue,
            completedCycles: row.completedCycles,
            updatedAt: row.updatedAt,
            rewardRule: row.rewardRule
          })),
          availableRewards: availableRewards.map((row) => ({
            id: row.id,
            rewardType: row.rewardType,
            rewardLabel: row.rewardLabel,
            discountPercentage: row.discountPercentage == null ? null : Number(row.discountPercentage),
            fixedAmount: row.fixedAmount == null ? null : Number(row.fixedAmount),
            customGiftText: row.customGiftText,
            issuedAt: row.issuedAt,
            status: row.status,
            rewardRule: row.rewardRule,
            rewardService: row.rewardService
          })),
          rewardHistory: rewardHistory.map((row) => ({
            id: row.id,
            rewardType: row.rewardType,
            rewardLabel: row.rewardLabel,
            discountPercentage: row.discountPercentage == null ? null : Number(row.discountPercentage),
            fixedAmount: row.fixedAmount == null ? null : Number(row.fixedAmount),
            customGiftText: row.customGiftText,
            issuedAt: row.issuedAt,
            redeemedAt: row.redeemedAt,
            status: row.status,
            redeemedBookingId: row.redeemedBookingId,
            rewardRule: row.rewardRule,
            rewardService: row.rewardService
          }))
        }
      }
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, updateCustomerSchema);
    const { id } = await context.params;

    const target = await prisma.user.findFirst({
      where: { id, role: Role.CUSTOMER },
      select: { id: true, status: true }
    });
    if (!target) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    let temporaryPassword: string | null = null;
    let updated;

    if (body.action === "suspend") {
      updated = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.SUSPENDED,
          isActive: false,
          suspendedAt: new Date(),
          suspensionReason: body.reason ?? null,
          suspendedByAdminId: actor.sub
        }
      });
    } else if (body.action === "activate") {
      updated = await prisma.user.update({
        where: { id },
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
      updated = await prisma.user.update({
        where: { id },
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
      updated = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
          isActive: true,
          bannedUntil: null,
          banReason: null,
          banMessage: null,
          bannedByAdminId: null
        }
      });
    } else if (body.action === "reset_password") {
      temporaryPassword = generateTemporaryPassword();
      updated = await prisma.user.update({
        where: { id },
        data: {
          passwordHash: await hashPassword(temporaryPassword),
          forcePasswordReset: true,
          mustChangePassword: true,
          lastPasswordChangeAt: null
        }
      });
    } else if (body.action === "force_password_reset") {
      updated = await prisma.user.update({
        where: { id },
        data: {
          forcePasswordReset: true,
          mustChangePassword: true
        }
      });
    } else {
      updated = await prisma.user.update({
        where: { id },
        data: {
          fullName: body.fullName,
          bio: body.bio,
          carCompany: body.carCompany,
          carType: body.carType,
          carModel: body.carModel,
          carYear: body.carYear,
          location: body.location,
          avatarUrl: body.avatarUrl
        }
      });
    }

    await logAudit({
      action: `CUSTOMER_${body.action.toUpperCase()}`,
      entity: "User",
      entityId: id,
      actorId: actor.sub,
      payload: {
        previousStatus: target.status,
        newStatus: updated.status
      }
    });

    return ok({
      item: {
        id: updated.id,
        status: updated.status.toLowerCase(),
        joinedAt: updated.createdAt
      },
      temporaryPassword
    });
  } catch (error) {
    return fail(error);
  }
}
