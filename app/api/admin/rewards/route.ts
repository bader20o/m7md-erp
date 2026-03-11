import { Prisma, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertValidRewardRule, normalizeRewardRuleData } from "@/lib/reward-rules";
import { requireRoles } from "@/lib/rbac";
import { createRewardRuleSchema } from "@/lib/validators/reward";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN, Role.EMPLOYEE]);

    const [rules, groupedCounts] = await Promise.all([
      prisma.rewardRule.findMany({
        include: {
          rewardService: {
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
              isActive: true
            }
          }
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }),
      prisma.customerReward.groupBy({
        by: ["rewardRuleId", "status"],
        _count: { _all: true }
      })
    ]);

    const usageMap = new Map<string, { issued: number; available: number; redeemed: number }>();
    for (const row of groupedCounts) {
      const current = usageMap.get(row.rewardRuleId) ?? { issued: 0, available: 0, redeemed: 0 };
      current.issued += row._count._all;
      if (row.status === "AVAILABLE") current.available += row._count._all;
      if (row.status === "REDEEMED") current.redeemed += row._count._all;
      usageMap.set(row.rewardRuleId, current);
    }

    return ok({
      items: rules.map((rule) => ({
        ...rule,
        discountPercentage: rule.discountPercentage == null ? null : Number(rule.discountPercentage),
        fixedAmount: rule.fixedAmount == null ? null : Number(rule.fixedAmount),
        usage: usageMap.get(rule.id) ?? { issued: 0, available: 0, redeemed: 0 }
      }))
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, createRewardRuleSchema);

    const data = normalizeRewardRuleData(body);
    assertValidRewardRule({
      triggerValue: data.triggerValue,
      rewardType: data.rewardType,
      rewardServiceId: data.rewardServiceId,
      rewardLabel: data.rewardLabel,
      discountPercentage: data.discountPercentage == null ? null : Number(data.discountPercentage),
      fixedAmount: data.fixedAmount == null ? null : Number(data.fixedAmount),
      customGiftText: data.customGiftText,
      periodDays: data.periodDays,
      startsAt: data.startsAt,
      endsAt: data.endsAt
    });

    if (data.rewardServiceId) {
      const service = await prisma.service.findUnique({ where: { id: data.rewardServiceId }, select: { id: true } });
      if (!service) {
        throw new ApiError(400, "INVALID_REWARD_SERVICE", "rewardServiceId must reference an existing service.");
      }
    }

    const created = await prisma.rewardRule.create({
      data,
      include: {
        rewardService: {
          select: { id: true, nameEn: true, nameAr: true, isActive: true }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "REWARD_RULE_CREATED",
        entity: "RewardRule",
        entityId: created.id,
        actorId: actor.sub,
        payload: { code: created.code, triggerType: created.triggerType, rewardType: created.rewardType }
      }
    });

    return ok(
      {
        item: {
          ...created,
          discountPercentage: created.discountPercentage == null ? null : Number(created.discountPercentage),
          fixedAmount: created.fixedAmount == null ? null : Number(created.fixedAmount)
        }
      },
      201
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new ApiError(409, "REWARD_CODE_EXISTS", "Reward code already exists."));
    }
    return fail(error);
  }
}
