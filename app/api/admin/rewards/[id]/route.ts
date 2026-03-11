import { Prisma, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertValidRewardRule, normalizeOptionalText } from "@/lib/reward-rules";
import { requireRoles } from "@/lib/rbac";
import { updateRewardRuleSchema } from "@/lib/validators/reward";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateRewardRuleSchema);

    const existing = await prisma.rewardRule.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "REWARD_RULE_NOT_FOUND", "Reward rule not found.");
    }

    const nextCode = body.code === undefined ? existing.code : body.code.trim().toUpperCase();
    const nextTitle = body.title === undefined ? existing.title : body.title.trim();
    const nextDescription = body.description === undefined ? existing.description : normalizeOptionalText(body.description);
    const nextTriggerType = body.triggerType ?? existing.triggerType;
    const nextTriggerValue = body.triggerValue ?? existing.triggerValue;
    const nextRewardType = body.rewardType ?? existing.rewardType;
    const nextRewardServiceId = body.rewardServiceId === undefined ? existing.rewardServiceId : body.rewardServiceId;
    const nextRewardLabel = body.rewardLabel === undefined ? existing.rewardLabel : normalizeOptionalText(body.rewardLabel);
    const nextDiscountPercentage =
      body.discountPercentage === undefined
        ? existing.discountPercentage == null
          ? null
          : Number(existing.discountPercentage)
        : body.discountPercentage;
    const nextFixedAmount =
      body.fixedAmount === undefined ? (existing.fixedAmount == null ? null : Number(existing.fixedAmount)) : body.fixedAmount;
    const nextCustomGiftText =
      body.customGiftText === undefined ? existing.customGiftText : normalizeOptionalText(body.customGiftText);
    const nextCurrency = body.currency === undefined ? existing.currency : normalizeOptionalText(body.currency);
    const nextPeriodDays = body.periodDays === undefined ? existing.periodDays : body.periodDays;
    const nextIsActive = body.isActive ?? existing.isActive;
    const nextSortOrder = body.sortOrder ?? existing.sortOrder;
    const nextStartsAt = body.startsAt === undefined ? existing.startsAt : body.startsAt ? new Date(body.startsAt) : null;
    const nextEndsAt = body.endsAt === undefined ? existing.endsAt : body.endsAt ? new Date(body.endsAt) : null;

    assertValidRewardRule({
      triggerValue: nextTriggerValue,
      rewardType: nextRewardType,
      rewardServiceId: nextRewardServiceId,
      rewardLabel: nextRewardLabel,
      discountPercentage: nextDiscountPercentage,
      fixedAmount: nextFixedAmount,
      customGiftText: nextCustomGiftText,
      periodDays: nextPeriodDays,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt
    });

    if (nextRewardServiceId) {
      const service = await prisma.service.findUnique({ where: { id: nextRewardServiceId }, select: { id: true } });
      if (!service) {
        throw new ApiError(400, "INVALID_REWARD_SERVICE", "rewardServiceId must reference an existing service.");
      }
    }

    const updated = await prisma.rewardRule.update({
      where: { id },
      data: {
        code: nextCode,
        title: nextTitle,
        description: nextDescription,
        triggerType: nextTriggerType,
        triggerValue: nextTriggerValue,
        rewardType: nextRewardType,
        rewardServiceId: nextRewardServiceId,
        rewardLabel: nextRewardLabel,
        discountPercentage: nextDiscountPercentage,
        fixedAmount: nextFixedAmount,
        customGiftText: nextCustomGiftText,
        currency: nextCurrency,
        periodDays: nextPeriodDays,
        isActive: nextIsActive,
        sortOrder: nextSortOrder,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt
      },
      include: {
        rewardService: {
          select: { id: true, nameEn: true, nameAr: true, isActive: true }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "REWARD_RULE_UPDATED",
        entity: "RewardRule",
        entityId: updated.id,
        actorId: actor.sub,
        payload: {
          code: updated.code,
          isActive: updated.isActive
        }
      }
    });

    return ok({
      item: {
        ...updated,
        discountPercentage: updated.discountPercentage == null ? null : Number(updated.discountPercentage),
        fixedAmount: updated.fixedAmount == null ? null : Number(updated.fixedAmount)
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new ApiError(409, "REWARD_CODE_EXISTS", "Reward code already exists."));
    }
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const { id } = await context.params;

    const existing = await prisma.rewardRule.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!existing) {
      throw new ApiError(404, "REWARD_RULE_NOT_FOUND", "Reward rule not found.");
    }

    try {
      await prisma.rewardRule.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          action: "REWARD_RULE_DELETED",
          entity: "RewardRule",
          entityId: id,
          actorId: actor.sub
        }
      });
      return ok({ deleted: true, archived: false });
    } catch (error) {
      const known = error as Prisma.PrismaClientKnownRequestError;
      if (known.code !== "P2003") {
        throw error;
      }

      await prisma.rewardRule.update({
        where: { id },
        data: { isActive: false }
      });

      await prisma.auditLog.create({
        data: {
          action: "REWARD_RULE_ARCHIVED",
          entity: "RewardRule",
          entityId: id,
          actorId: actor.sub,
          payload: { reason: "HAS_HISTORY" }
        }
      });

      return ok({ deleted: false, archived: true });
    }
  } catch (error) {
    return fail(error);
  }
}
