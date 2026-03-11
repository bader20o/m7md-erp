import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import {
  CustomerRewardStatus,
  RewardSourceType,
  RewardTriggerType,
  RewardType,
  type Prisma,
  type RewardRule
} from "@prisma/client";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type ActiveRule = RewardRule;

type VisitQrClaims = {
  typ: "VISIT_QR";
  branchId?: string;
};

const loyaltyQrSecret = new TextEncoder().encode(env.LOYALTY_QR_SECRET ?? env.AUTH_JWT_SECRET);
const loyaltyIssuer = "evsc:loyalty";
const DAY_MS = 24 * 60 * 60 * 1000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  return Number(value);
}

export function getVisitDateKey(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: env.ATTENDANCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "01");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "01");

  return new Date(Date.UTC(year, month - 1, day));
}

function getStartOfMonth(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: env.ATTENDANCE_TIMEZONE,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "01");

  return new Date(Date.UTC(year, month - 1, 1));
}

function getStartOfNextMonth(now = new Date()): Date {
  const monthStart = getStartOfMonth(now);
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
}

function isRuleActiveNow(rule: ActiveRule, now: Date): boolean {
  if (!rule.isActive) return false;
  if (rule.startsAt && rule.startsAt > now) return false;
  if (rule.endsAt && rule.endsAt < now) return false;
  return true;
}

function isRuleIssuable(rule: ActiveRule): boolean {
  if (rule.triggerValue <= 0) return false;

  if (rule.rewardType === RewardType.FREE_SERVICE) {
    return Boolean(rule.rewardServiceId);
  }

  if (rule.rewardType === RewardType.DISCOUNT_PERCENTAGE) {
    const percentage = toNumber(rule.discountPercentage);
    return percentage > 0 && percentage <= 100;
  }

  if (rule.rewardType === RewardType.FIXED_AMOUNT_DISCOUNT) {
    return toNumber(rule.fixedAmount) > 0;
  }

  if (rule.rewardType === RewardType.CUSTOM_GIFT) {
    return Boolean(rule.customGiftText?.trim() || rule.rewardLabel?.trim());
  }

  return false;
}

function getWindowStartFromFirstEvent(firstEventAt: Date, periodDays: number, now: Date): Date {
  const periodMs = periodDays * DAY_MS;
  const elapsed = Math.max(0, now.getTime() - firstEventAt.getTime());
  const windowsPassed = Math.floor(elapsed / periodMs);
  return new Date(firstEventAt.getTime() + windowsPassed * periodMs);
}

function getWindowEnd(windowStart: Date, periodDays: number): Date {
  return new Date(windowStart.getTime() + periodDays * DAY_MS);
}

async function listActiveRules(triggerType?: RewardTriggerType): Promise<ActiveRule[]> {
  const now = new Date();

  const rules = await prisma.rewardRule.findMany({
    where: {
      triggerType,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return rules.filter((rule) => isRuleActiveNow(rule, now));
}

async function syncCustomerProgressForRule(customerId: string, rule: ActiveRule): Promise<number> {
  const now = new Date();
  let windowStart: Date | null = null;

  if (rule.periodDays) {
    const firstEvent = await prisma.rewardEvent.findFirst({
      where: {
        customerId,
        rewardRuleId: rule.id
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true }
    });

    if (firstEvent) {
      windowStart = getWindowStartFromFirstEvent(firstEvent.createdAt, rule.periodDays, now);
    }
  }

  const totalEvents = await prisma.rewardEvent.count({
    where: {
      customerId,
      rewardRuleId: rule.id,
      ...(windowStart ? { createdAt: { gte: windowStart } } : {})
    }
  });

  const earnedCycles = Math.floor(totalEvents / rule.triggerValue);
  const progressValue = totalEvents % rule.triggerValue;

  await prisma.customerRewardProgress.upsert({
    where: {
      customerId_rewardRuleId: {
        customerId,
        rewardRuleId: rule.id
      }
    },
    update: {
      progressValue,
      completedCycles: earnedCycles
    },
    create: {
      customerId,
      rewardRuleId: rule.id,
      progressValue,
      completedCycles: earnedCycles
    }
  });

  if (!isRuleIssuable(rule)) {
    return 0;
  }

  const issuedCount = await prisma.customerReward.count({
    where: {
      customerId,
      rewardRuleId: rule.id,
      ...(windowStart ? { issuedAt: { gte: windowStart } } : {})
    }
  });

  const toIssue = earnedCycles - issuedCount;
  if (toIssue <= 0) {
    return 0;
  }

  let issued = 0;
  for (let index = 0; index < toIssue; index += 1) {
    await prisma.customerReward.create({
      data: {
        customerId,
        rewardRuleId: rule.id,
        rewardType: rule.rewardType,
        rewardServiceId: rule.rewardServiceId,
        rewardLabel: rule.rewardLabel,
        discountPercentage: rule.discountPercentage,
        fixedAmount: rule.fixedAmount,
        customGiftText: rule.customGiftText,
        status: CustomerRewardStatus.AVAILABLE
      }
    });
    issued += 1;
  }

  return issued;
}

async function applySourceToRules(input: {
  customerId: string;
  sourceType: RewardSourceType;
  sourceId: string;
  triggerType: RewardTriggerType;
}): Promise<{ issuedCount: number }> {
  const rules = await listActiveRules(input.triggerType);
  if (rules.length === 0) {
    return { issuedCount: 0 };
  }

  let issuedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const rule of rules) {
      let created = false;
      try {
        await tx.rewardEvent.create({
          data: {
            customerId: input.customerId,
            rewardRuleId: rule.id,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            progressDelta: 1
          }
        });
        created = true;
      } catch (error) {
        const known = error as Prisma.PrismaClientKnownRequestError;
        if (known.code !== "P2002") {
          throw error;
        }
      }

      if (!created) {
        continue;
      }

      const now = new Date();
      let windowStart: Date | null = null;

      if (rule.periodDays) {
        const firstEvent = await tx.rewardEvent.findFirst({
          where: {
            customerId: input.customerId,
            rewardRuleId: rule.id
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true }
        });

        if (firstEvent) {
          windowStart = getWindowStartFromFirstEvent(firstEvent.createdAt, rule.periodDays, now);
        }
      }

      const totalEvents = await tx.rewardEvent.count({
        where: {
          customerId: input.customerId,
          rewardRuleId: rule.id,
          ...(windowStart ? { createdAt: { gte: windowStart } } : {})
        }
      });

      const earnedCycles = Math.floor(totalEvents / rule.triggerValue);
      const progressValue = totalEvents % rule.triggerValue;

      await tx.customerRewardProgress.upsert({
        where: {
          customerId_rewardRuleId: {
            customerId: input.customerId,
            rewardRuleId: rule.id
          }
        },
        update: {
          progressValue,
          completedCycles: earnedCycles
        },
        create: {
          customerId: input.customerId,
          rewardRuleId: rule.id,
          progressValue,
          completedCycles: earnedCycles
        }
      });

      if (!isRuleIssuable(rule)) {
        continue;
      }

      const issuedSoFar = await tx.customerReward.count({
        where: {
          customerId: input.customerId,
          rewardRuleId: rule.id,
          ...(windowStart ? { issuedAt: { gte: windowStart } } : {})
        }
      });

      const toIssue = earnedCycles - issuedSoFar;
      if (toIssue <= 0) {
        continue;
      }

      for (let index = 0; index < toIssue; index += 1) {
        await tx.customerReward.create({
          data: {
            customerId: input.customerId,
            rewardRuleId: rule.id,
            rewardType: rule.rewardType,
            rewardServiceId: rule.rewardServiceId,
            rewardLabel: rule.rewardLabel,
            discountPercentage: rule.discountPercentage,
            fixedAmount: rule.fixedAmount,
            customGiftText: rule.customGiftText,
            status: CustomerRewardStatus.AVAILABLE
          }
        });
        issuedCount += 1;
      }
    }
  });

  return { issuedCount };
}

export async function handleBookingCompletedLoyalty(input: {
  bookingId: string;
  customerId: string;
}): Promise<{ issuedCount: number }> {
  return applySourceToRules({
    customerId: input.customerId,
    sourceType: RewardSourceType.BOOKING_COMPLETION,
    sourceId: input.bookingId,
    triggerType: RewardTriggerType.COMPLETED_BOOKING_COUNT
  });
}

export async function issueRewardsForHistoricCustomer(customerId: string): Promise<void> {
  const rules = await prisma.rewardRule.findMany({ where: { isActive: true } });
  for (const rule of rules) {
    await syncCustomerProgressForRule(customerId, rule);
  }
}

export async function generateVisitQrToken(branchId?: string): Promise<{
  token: string;
  expiresAt: string;
  rotationId: string;
  refreshEverySeconds: number;
}> {
  const rotationSeconds = Number(env.LOYALTY_QR_ROTATION_SECONDS ?? 5);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = nowSeconds + rotationSeconds;
  const rotationId = randomUUID();

  const payload: VisitQrClaims = {
    typ: "VISIT_QR",
    branchId: branchId || undefined
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(loyaltyIssuer)
    .setAudience("VISIT_QR")
    .setJti(rotationId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(loyaltyQrSecret);

  return {
    token,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    rotationId,
    refreshEverySeconds: rotationSeconds
  };
}

export async function validateVisitQrToken(token: string): Promise<{
  rotationId: string;
  branchId: string | null;
}> {
  try {
    const verified = await jwtVerify(token, loyaltyQrSecret, {
      issuer: loyaltyIssuer,
      audience: "VISIT_QR"
    });

    const claims = verified.payload as VisitQrClaims & { jti?: string; typ?: string };
    if (claims.typ !== "VISIT_QR") {
      throw new ApiError(400, "INVALID_QR_TYPE", "Invalid QR code type.");
    }

    if (!verified.payload.jti) {
      throw new ApiError(400, "INVALID_QR", "Malformed QR token.");
    }

    return {
      rotationId: verified.payload.jti,
      branchId: typeof claims.branchId === "string" ? claims.branchId : null
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "JWTExpired") {
      throw new ApiError(400, "QR_EXPIRED", "QR expired, please scan again.");
    }

    throw new ApiError(400, "INVALID_QR", "Invalid QR code.");
  }
}

export async function registerVisitCheckIn(input: {
  customerId: string;
  token: string;
  notes?: string;
}): Promise<{
  success: boolean;
  alreadyRegistered: boolean;
  message: string;
  visitId: string | null;
  issuedRewards: number;
}> {
  const decoded = await validateVisitQrToken(input.token);
  const visitDate = getVisitDateKey();
  const checkedInAt = new Date();

  try {
    const visit = await prisma.customerVisit.create({
      data: {
        customerId: input.customerId,
        checkedInAt,
        visitDate,
        checkInMethod: "QR",
        qrRotationId: decoded.rotationId,
        branchId: decoded.branchId,
        notes: input.notes
      }
    });

    const rewardResult = await applySourceToRules({
      customerId: input.customerId,
      sourceType: RewardSourceType.VISIT,
      sourceId: visit.id,
      triggerType: RewardTriggerType.VISIT_COUNT
    });

    return {
      success: true,
      alreadyRegistered: false,
      message: "Visit registered successfully.",
      visitId: visit.id,
      issuedRewards: rewardResult.issuedCount
    };
  } catch (error) {
    const known = error as Prisma.PrismaClientKnownRequestError;
    if (known.code === "P2002") {
      return {
        success: false,
        alreadyRegistered: true,
        message: "Visit already registered today.",
        visitId: null,
        issuedRewards: 0
      };
    }
    throw error;
  }
}

export async function getCustomerRewardsPayload(customerId: string): Promise<{
  activeRules: Array<{
    id: string;
    title: string;
    description: string | null;
    triggerType: RewardTriggerType;
    triggerValue: number;
    rewardType: RewardType;
    rewardLabel: string | null;
    rewardServiceName: string | null;
    discountPercentage: number | null;
    fixedAmount: number | null;
    customGiftText: string | null;
    progressValue: number;
    completedCycles: number;
    remainingToUnlock: number;
    periodDays: number | null;
    periodResetAt: Date | null;
    daysUntilReset: number | null;
  }>;
  availableRewards: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
}> {
  const now = new Date();

  const [rules, progressRows, firstEventRows, availableRewards, history] = await Promise.all([
    prisma.rewardRule.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
      },
      include: {
        rewardService: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.customerRewardProgress.findMany({
      where: { customerId }
    }),
    prisma.rewardEvent.groupBy({
      by: ["rewardRuleId"],
      where: { customerId },
      _min: { createdAt: true }
    }),
    prisma.customerReward.findMany({
      where: {
        customerId,
        status: CustomerRewardStatus.AVAILABLE
      },
      include: {
        rewardRule: {
          select: { id: true, title: true, triggerType: true, triggerValue: true }
        },
        rewardService: {
          select: { id: true, nameEn: true, nameAr: true }
        }
      },
      orderBy: [{ issuedAt: "desc" }]
    }),
    prisma.customerReward.findMany({
      where: {
        customerId,
        status: { in: [CustomerRewardStatus.REDEEMED, CustomerRewardStatus.EXPIRED, CustomerRewardStatus.CANCELLED] }
      },
      include: {
        rewardRule: {
          select: { id: true, title: true, triggerType: true, triggerValue: true }
        },
        rewardService: {
          select: { id: true, nameEn: true, nameAr: true }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    })
  ]);

  const progressMap = new Map(progressRows.map((row) => [row.rewardRuleId, row]));
  const firstEventMap = new Map(firstEventRows.map((row) => [row.rewardRuleId, row._min.createdAt ?? null]));

  return {
    activeRules: rules.map((rule) => {
      const progress = progressMap.get(rule.id);
      const progressValue = progress?.progressValue ?? 0;
      const completedCycles = progress?.completedCycles ?? 0;
      const remainingToUnlock = Math.max(0, rule.triggerValue - progressValue);
      const periodDays = rule.periodDays ?? null;
      const firstEventAt = firstEventMap.get(rule.id) ?? null;

      let periodResetAt: Date | null = null;
      let daysUntilReset: number | null = null;

      if (periodDays && firstEventAt) {
        const windowStart = getWindowStartFromFirstEvent(firstEventAt, periodDays, now);
        periodResetAt = getWindowEnd(windowStart, periodDays);
        daysUntilReset = Math.max(0, Math.ceil((periodResetAt.getTime() - now.getTime()) / DAY_MS));
      }

      return {
        id: rule.id,
        title: rule.title,
        description: rule.description,
        triggerType: rule.triggerType,
        triggerValue: rule.triggerValue,
        rewardType: rule.rewardType,
        rewardLabel: rule.rewardLabel,
        rewardServiceName: rule.rewardService ? rule.rewardService.nameEn : null,
        discountPercentage: rule.discountPercentage == null ? null : toNumber(rule.discountPercentage),
        fixedAmount: rule.fixedAmount == null ? null : toNumber(rule.fixedAmount),
        customGiftText: rule.customGiftText,
        progressValue,
        completedCycles,
        remainingToUnlock,
        periodDays,
        periodResetAt,
        daysUntilReset
      };
    }),
    availableRewards: availableRewards.map((item) => ({
      id: item.id,
      status: item.status,
      issuedAt: item.issuedAt,
      rewardType: item.rewardType,
      rewardLabel: item.rewardLabel,
      discountPercentage: item.discountPercentage == null ? null : toNumber(item.discountPercentage),
      fixedAmount: item.fixedAmount == null ? null : toNumber(item.fixedAmount),
      customGiftText: item.customGiftText,
      rewardRule: item.rewardRule,
      rewardService: item.rewardService
    })),
    history: history.map((item) => ({
      id: item.id,
      status: item.status,
      issuedAt: item.issuedAt,
      redeemedAt: item.redeemedAt,
      rewardType: item.rewardType,
      rewardLabel: item.rewardLabel,
      discountPercentage: item.discountPercentage == null ? null : toNumber(item.discountPercentage),
      fixedAmount: item.fixedAmount == null ? null : toNumber(item.fixedAmount),
      customGiftText: item.customGiftText,
      redeemedBookingId: item.redeemedBookingId,
      rewardRule: item.rewardRule,
      rewardService: item.rewardService
    }))
  };
}

export async function getAdminRewardsStats(): Promise<{
  activeRewards: number;
  issuedRewards: number;
  redeemedRewards: number;
  availableRewards: number;
  qrVisitsToday: number;
  qrVisitsThisMonth: number;
  mostEarnedReward: string | null;
  mostRedeemedReward: string | null;
}> {
  const now = new Date();
  const dayKey = getVisitDateKey(now);
  const monthStart = getStartOfMonth(now);
  const nextMonth = getStartOfNextMonth(now);

  const [activeRewards, issuedRewards, redeemedRewards, availableRewards, qrVisitsToday, qrVisitsThisMonth, earnedRows, redeemedRows] =
    await Promise.all([
      prisma.rewardRule.count({
        where: {
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
        }
      }),
      prisma.customerReward.count(),
      prisma.customerReward.count({ where: { status: CustomerRewardStatus.REDEEMED } }),
      prisma.customerReward.count({ where: { status: CustomerRewardStatus.AVAILABLE } }),
      prisma.customerVisit.count({ where: { visitDate: dayKey, checkInMethod: "QR" } }),
      prisma.customerVisit.count({ where: { checkInMethod: "QR", checkedInAt: { gte: monthStart, lt: nextMonth } } }),
      prisma.customerReward.groupBy({
        by: ["rewardRuleId"],
        _count: { _all: true },
        orderBy: { _count: { rewardRuleId: "desc" } },
        take: 1
      }),
      prisma.customerReward.groupBy({
        by: ["rewardRuleId"],
        where: { status: CustomerRewardStatus.REDEEMED },
        _count: { _all: true },
        orderBy: { _count: { rewardRuleId: "desc" } },
        take: 1
      })
    ]);

  const topEarnedRuleId = earnedRows[0]?.rewardRuleId;
  const topRedeemedRuleId = redeemedRows[0]?.rewardRuleId;

  const [topEarnedRule, topRedeemedRule] = await Promise.all([
    topEarnedRuleId ? prisma.rewardRule.findUnique({ where: { id: topEarnedRuleId }, select: { title: true } }) : null,
    topRedeemedRuleId ? prisma.rewardRule.findUnique({ where: { id: topRedeemedRuleId }, select: { title: true } }) : null
  ]);

  return {
    activeRewards,
    issuedRewards,
    redeemedRewards,
    availableRewards,
    qrVisitsToday,
    qrVisitsThisMonth,
    mostEarnedReward: topEarnedRule?.title ?? null,
    mostRedeemedReward: topRedeemedRule?.title ?? null
  };
}

export function computeRewardAdjustedFinalPrice(input: {
  rewardType: RewardType;
  originalPrice: number;
  discountPercentage: number | null;
  fixedAmount: number | null;
  finalPriceFallback: number;
}): number {
  if (input.rewardType === RewardType.FREE_SERVICE) {
    return 0;
  }

  if (input.rewardType === RewardType.DISCOUNT_PERCENTAGE) {
    const pct = input.discountPercentage ?? 0;
    return round2(Math.max(0, input.originalPrice - (input.originalPrice * pct) / 100));
  }

  if (input.rewardType === RewardType.FIXED_AMOUNT_DISCOUNT) {
    const amount = input.fixedAmount ?? 0;
    return round2(Math.max(0, input.originalPrice - amount));
  }

  return round2(Math.max(0, input.finalPriceFallback));
}
