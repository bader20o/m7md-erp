import { addMonths } from "date-fns";
import {
  IncomeSource,
  MembershipOrderStatus,
  NotificationType,
  Prisma,
  Role,
  TransactionType
} from "@prisma/client";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type MembershipDbClient = Prisma.TransactionClient | typeof prisma;

type PlanInput = {
  tier?: string;
  nameEn?: string;
  nameAr?: string;
  imageUrl?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  price?: number;
  durationMonths?: number;
  color?: string | null;
  isActive?: boolean;
  benefits?: Array<{
    id?: string;
    code: string;
    titleEn: string;
    titleAr: string;
    descriptionEn?: string | null;
    descriptionAr?: string | null;
    limitCount: number;
    isActive?: boolean;
  }>;
};

type DeliveryInput = {
  deliveryCompanyName?: string | null;
  deliveryPhone?: string | null;
  deliveryTrackingCode?: string | null;
  deliveryNote?: string | null;
};

const membershipPlanInclude = Prisma.validator<Prisma.MembershipPlanInclude>()({
  benefits: { orderBy: [{ createdAt: "asc" }, { code: "asc" }] },
  entitlements: {
    include: { service: true },
    orderBy: [{ createdAt: "asc" }, { serviceId: "asc" }]
  }
});

const membershipOrderDetailInclude = Prisma.validator<Prisma.MembershipOrderInclude>()({
  customer: {
    select: {
      id: true,
      fullName: true,
      phone: true
    }
  },
  approvedByAdmin: {
    select: {
      id: true,
      fullName: true,
      phone: true
    }
  },
  rejectedByAdmin: {
    select: {
      id: true,
      fullName: true,
      phone: true
    }
  },
  plan: {
    include: membershipPlanInclude
  },
  orderBenefits: {
    include: {
      planBenefit: true,
      uses: {
        orderBy: { usedAt: "asc" },
        include: {
          usedByAdmin: {
            select: {
              id: true,
              fullName: true,
              phone: true
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: "asc" }, { code: "asc" }]
  },
  adminNotes: {
    orderBy: { createdAt: "desc" },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          fullName: true,
          phone: true
        }
      }
    }
  },
  transactions: {
    orderBy: { createdAt: "desc" }
  }
});

type MembershipPlanWithBenefits = Prisma.MembershipPlanGetPayload<{
  include: typeof membershipPlanInclude;
}>;

type MembershipOrderDetail = Prisma.MembershipOrderGetPayload<{
  include: typeof membershipOrderDetailInclude;
}>;

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number(value.toString());
}

function normalizeText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertUniqueBenefitCodes(benefits?: PlanInput["benefits"]): void {
  if (!benefits) return;

  const seen = new Set<string>();
  for (const benefit of benefits) {
    const normalized = benefit.code.trim().toLowerCase();
    if (!normalized) {
      throw new ApiError(400, "BENEFIT_CODE_REQUIRED", "Benefit code is required.");
    }
    if (seen.has(normalized)) {
      throw new ApiError(
        400,
        "DUPLICATE_BENEFIT_CODE",
        "Benefit code must be unique within the plan."
      );
    }
    seen.add(normalized);
  }
}

function isMembershipSchemaCompatibilityError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function isSkipDuplicatesUnsupportedError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientValidationError)) {
    return false;
  }
  const message = String(error.message || "").toLowerCase();
  return message.includes("skipduplicates") && message.includes("unknown argument");
}

async function createManyWithOptionalSkipDuplicates(
  operationWithSkipDuplicates: () => Promise<void>,
  operationWithoutSkipDuplicates: () => Promise<void>
): Promise<void> {
  try {
    await operationWithSkipDuplicates();
  } catch (error) {
    if (!isSkipDuplicatesUnsupportedError(error)) {
      throw error;
    }
    await operationWithoutSkipDuplicates();
  }
}

function mapMembershipPlanMutationError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(",")
      : String(error.meta?.target ?? "");

    if (target.includes("tier")) {
      throw new ApiError(
        409,
        "PLAN_TIER_ALREADY_EXISTS",
        "A membership plan for this tier already exists."
      );
    }

    if (target.includes("planId") && target.includes("code")) {
      throw new ApiError(
        409,
        "BENEFIT_CODE_ALREADY_EXISTS",
        "Benefit code must be unique within the plan."
      );
    }
  }

  throw error;
}

function containsNormalized(value: string | null | undefined, query: string | undefined): boolean {
  if (!query) return true;
  return (value ?? "").toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function mapLegacyMembershipStatus(status: string): MembershipOrderStatus {
  switch (status) {
    case MembershipOrderStatus.ACTIVE:
      return MembershipOrderStatus.ACTIVE;
    case MembershipOrderStatus.EXPIRED:
      return MembershipOrderStatus.EXPIRED;
    case "SUSPENDED":
      return MembershipOrderStatus.CANCELLED;
    default:
      return MembershipOrderStatus.CANCELLED;
  }
}

function getDurationMonths(durationDays: number, durationMonths?: number | null): number {
  if (durationMonths && durationMonths > 0) {
    return durationMonths;
  }
  return Math.max(1, Math.round(durationDays / 30) || 1);
}

function getPlanPresentation(plan: MembershipPlanWithBenefits) {
  return {
    id: plan.id,
    tier: plan.tier,
    nameEn: plan.nameEn,
    nameAr: plan.nameAr,
    descriptionEn: plan.descriptionEn,
    descriptionAr: plan.descriptionAr,
    priceJod: toNumber(plan.price),
    durationMonths: getDurationMonths(plan.durationDays, plan.durationMonths),
    durationDays: plan.durationDays,
    themeColor: plan.color,
    color: plan.color,
    imageUrl: plan.imageUrl,
    isActive: plan.isActive,
    benefits: plan.benefits
      .filter((benefit) => benefit.isActive)
      .map((benefit) => ({
        id: benefit.id,
        code: benefit.code,
        titleEn: benefit.titleEn,
        titleAr: benefit.titleAr,
        descriptionEn: benefit.descriptionEn,
        descriptionAr: benefit.descriptionAr,
        limitCount: benefit.limitCount,
        isActive: benefit.isActive
      }))
  };
}

function getLegacyPlanPresentation(plan: {
  id: string;
  tier: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  price: Prisma.Decimal | number | string;
  durationDays: number;
  isActive: boolean;
}) {
  return {
    id: plan.id,
    tier: plan.tier,
    nameEn: plan.nameEn,
    nameAr: plan.nameAr,
    descriptionEn: plan.descriptionEn,
    descriptionAr: plan.descriptionAr,
    priceJod: toNumber(plan.price),
    durationMonths: getDurationMonths(plan.durationDays, null),
    durationDays: plan.durationDays,
    themeColor: null,
    color: null,
    imageUrl: null,
    isActive: plan.isActive,
    benefits: []
  };
}

function getBenefitSummary(benefit: MembershipOrderDetail["orderBenefits"][number]) {
  const usedCount = benefit.uses.length;
  const remainingCount = Math.max(benefit.limitCount - usedCount, 0);
  return {
    id: benefit.id,
    code: benefit.code,
    titleEn: benefit.titleEn,
    titleAr: benefit.titleAr,
    descriptionEn: benefit.descriptionEn,
    descriptionAr: benefit.descriptionAr,
    limitCount: benefit.limitCount,
    usedCount,
    remainingCount,
    locked: remainingCount === 0,
    isActive: benefit.isActive,
    uses: benefit.uses.map((use) => ({
      id: use.id,
      usedAt: use.usedAt.toISOString(),
      confirmNote: use.confirmNote,
      usedByAdmin: {
        id: use.usedByAdmin.id,
        fullName: use.usedByAdmin.fullName,
        phone: use.usedByAdmin.phone
      }
    }))
  };
}

function getSubscriptionPresentation(order: MembershipOrderDetail) {
  const benefits = order.orderBenefits.map(getBenefitSummary);
  return {
    id: order.id,
    status: order.status,
    requestedAt: order.requestedAt.toISOString(),
    approvedAt: order.approvedAt?.toISOString() ?? null,
    rejectedAt: order.rejectedAt?.toISOString() ?? null,
    expiresAt: order.expiresAt?.toISOString() ?? order.endDate?.toISOString() ?? null,
    startDate: order.startDate?.toISOString() ?? null,
    endDate: order.endDate?.toISOString() ?? null,
    rejectionReason: order.rejectionReason,
    priceSnapshot: toNumber(order.priceSnapshot),
    delivery: {
      deliveryCompanyName: order.deliveryCompanyName,
      deliveryPhone: order.deliveryPhone,
      deliveryTrackingCode: order.deliveryTrackingCode,
      deliveryNote: order.deliveryNote
    },
    customer: {
      id: order.customer.id,
      fullName: order.customer.fullName,
      phone: order.customer.phone
    },
    plan: getPlanPresentation(order.plan),
    benefitUsageSummary: {
      used: benefits.reduce((sum, benefit) => sum + benefit.usedCount, 0),
      total: benefits.reduce((sum, benefit) => sum + benefit.limitCount, 0)
    },
    benefits,
    adminNotes: order.adminNotes.map((note) => ({
      id: note.id,
      note: note.note,
      createdAt: note.createdAt.toISOString(),
      createdByAdmin: {
        id: note.createdByAdmin.id,
        fullName: note.createdByAdmin.fullName,
        phone: note.createdByAdmin.phone
      }
    })),
    adminNotesCount: order.adminNotes.length,
    approvedByAdmin: order.approvedByAdmin
      ? {
          id: order.approvedByAdmin.id,
          fullName: order.approvedByAdmin.fullName,
          phone: order.approvedByAdmin.phone
        }
      : null,
    rejectedByAdmin: order.rejectedByAdmin
      ? {
          id: order.rejectedByAdmin.id,
          fullName: order.rejectedByAdmin.fullName,
          phone: order.rejectedByAdmin.phone
        }
      : null
  };
}

async function ensurePlanBenefitDefinitions(
  db: MembershipDbClient,
  planId: string
): Promise<MembershipPlanWithBenefits> {
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
    include: membershipPlanInclude
  });

  if (!plan) {
    throw new ApiError(404, "PLAN_NOT_FOUND", "Membership plan not found.");
  }

  if (plan.benefits.length > 0 || plan.entitlements.length === 0) {
    return plan;
  }

  const benefitRows = plan.entitlements.map((entitlement) => ({
    planId: plan.id,
    code: `service_${entitlement.serviceId}`,
    titleEn: entitlement.service.nameEn,
    titleAr: entitlement.service.nameAr,
    descriptionEn: entitlement.service.descriptionEn,
    descriptionAr: entitlement.service.descriptionAr,
    limitCount: entitlement.totalUses,
    isActive: true
  }));

  await createManyWithOptionalSkipDuplicates(
    () =>
      db.membershipBenefit.createMany({
        data: benefitRows,
        skipDuplicates: true
      }),
    () =>
      db.membershipBenefit.createMany({
        data: benefitRows
      })
  );

  const refreshedPlan = await db.membershipPlan.findUnique({
    where: { id: planId },
    include: membershipPlanInclude
  });

  if (!refreshedPlan) {
    throw new ApiError(404, "PLAN_NOT_FOUND", "Membership plan not found.");
  }

  return refreshedPlan;
}

export async function ensureOrderBenefitSnapshots(
  db: MembershipDbClient,
  membershipOrderId: string
): Promise<void> {
  const existingCount = await db.membershipOrderBenefit.count({
    where: { membershipOrderId }
  });
  if (existingCount > 0) {
    return;
  }

  const order = await db.membershipOrder.findUnique({
    where: { id: membershipOrderId },
    include: {
      plan: {
        include: membershipPlanInclude
      }
    }
  });

  if (!order || order.status !== MembershipOrderStatus.ACTIVE) {
    return;
  }

  const plan = await ensurePlanBenefitDefinitions(db, order.planId);
  if (!plan.benefits.length) {
    return;
  }

  const orderBenefitRows = plan.benefits
    .filter((benefit) => benefit.isActive)
    .map((benefit) => ({
      membershipOrderId: order.id,
      planBenefitId: benefit.id,
      code: benefit.code,
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      descriptionEn: benefit.descriptionEn,
      descriptionAr: benefit.descriptionAr,
      limitCount: benefit.limitCount,
      isActive: benefit.isActive
    }));

  await createManyWithOptionalSkipDuplicates(
    () =>
      db.membershipOrderBenefit.createMany({
        data: orderBenefitRows,
        skipDuplicates: true
      }),
    () =>
      db.membershipOrderBenefit.createMany({
        data: orderBenefitRows
      })
  );
}

async function getOrderDetailOrThrow(membershipOrderId: string): Promise<MembershipOrderDetail> {
  const order = await prisma.membershipOrder.findUnique({
    where: { id: membershipOrderId },
    include: membershipOrderDetailInclude
  });

  if (!order) {
    throw new ApiError(404, "SUBSCRIPTION_NOT_FOUND", "Membership subscription not found.");
  }

  return order;
}

function pickCurrentOrder<T extends { status: MembershipOrderStatus }>(orders: T[]): T | null {
  return (
    orders.find((order) => order.status === MembershipOrderStatus.ACTIVE) ??
    orders.find((order) => order.status === MembershipOrderStatus.PENDING) ??
    orders.find((order) => order.status === MembershipOrderStatus.REJECTED) ??
    orders.find(
      (order) =>
        order.status === MembershipOrderStatus.EXPIRED || order.status === MembershipOrderStatus.CANCELLED
    ) ??
    null
  );
}

async function createOrUpdatePlanCore(
  tx: MembershipDbClient,
  id: string | null,
  input: PlanInput
): Promise<MembershipPlanWithBenefits> {
  const data: Prisma.MembershipPlanUncheckedCreateInput | Prisma.MembershipPlanUncheckedUpdateInput = {};

  assertUniqueBenefitCodes(input.benefits);

  if (input.tier !== undefined) data.tier = input.tier.trim();
  if (input.nameEn !== undefined) data.nameEn = input.nameEn;
  if (input.nameAr !== undefined) data.nameAr = input.nameAr;
  if (input.imageUrl !== undefined) data.imageUrl = normalizeText(input.imageUrl);
  if (input.descriptionEn !== undefined) data.descriptionEn = normalizeText(input.descriptionEn);
  if (input.descriptionAr !== undefined) data.descriptionAr = normalizeText(input.descriptionAr);
  if (input.price !== undefined) data.price = Math.max(0, input.price);
  if (input.durationMonths !== undefined) {
    data.durationMonths = input.durationMonths;
    data.durationDays = input.durationMonths * 30;
  }
  if (input.color !== undefined) data.color = normalizeText(input.color);
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const plan =
    id === null
      ? await tx.membershipPlan.create({
          data: data as Prisma.MembershipPlanUncheckedCreateInput,
          include: membershipPlanInclude
        })
      : await tx.membershipPlan.update({
          where: { id },
          data: data as Prisma.MembershipPlanUncheckedUpdateInput,
          include: membershipPlanInclude
        });

  if (!input.benefits) {
    return plan;
  }

  const existingBenefits = await tx.membershipBenefit.findMany({
    where: { planId: plan.id },
    select: { id: true }
  });
  const submittedIds = new Set(input.benefits.map((benefit) => benefit.id).filter(Boolean));

  for (const benefit of input.benefits) {
    const benefitData = {
      code: benefit.code.trim(),
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      descriptionEn: normalizeText(benefit.descriptionEn),
      descriptionAr: normalizeText(benefit.descriptionAr),
      limitCount: benefit.limitCount,
      isActive: benefit.isActive ?? true
    };

    if (benefit.id) {
      await tx.membershipBenefit.update({
        where: { id: benefit.id },
        data: benefitData
      });
      continue;
    }

    await tx.membershipBenefit.create({
      data: {
        planId: plan.id,
        ...benefitData
      }
    });
  }

  const idsToDeactivate = existingBenefits
    .map((benefit) => benefit.id)
    .filter((benefitId) => !submittedIds.has(benefitId));

  if (idsToDeactivate.length > 0) {
    await tx.membershipBenefit.updateMany({
      where: { id: { in: idsToDeactivate } },
      data: { isActive: false }
    });
  }

  const refreshedPlan = await tx.membershipPlan.findUnique({
    where: { id: plan.id },
    include: membershipPlanInclude
  });

  if (!refreshedPlan) {
    throw new ApiError(404, "PLAN_NOT_FOUND", "Membership plan not found.");
  }

  return refreshedPlan;
}

export async function listMembershipPlans(input?: { includeInactive?: boolean }) {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: input?.includeInactive ? undefined : { isActive: true },
      include: membershipPlanInclude,
      orderBy: [{ createdAt: "desc" }, { tier: "asc" }]
    });

    for (const plan of plans) {
      if (plan.benefits.length === 0 && plan.entitlements.length > 0) {
        await ensurePlanBenefitDefinitions(prisma, plan.id);
      }
    }

    const refreshedPlans = await prisma.membershipPlan.findMany({
      where: input?.includeInactive ? undefined : { isActive: true },
      include: membershipPlanInclude,
      orderBy: [{ createdAt: "desc" }, { tier: "asc" }]
    });

    return refreshedPlans.map(getPlanPresentation);
  } catch (error) {
    if (!isMembershipSchemaCompatibilityError(error)) {
      throw error;
    }

    const legacyPlans = await prisma.membershipPlan.findMany({
      where: input?.includeInactive ? undefined : { isActive: true },
      select: {
        id: true,
        tier: true,
        nameEn: true,
        nameAr: true,
        descriptionEn: true,
        descriptionAr: true,
        price: true,
        durationDays: true,
        isActive: true
      },
      orderBy: [{ createdAt: "desc" }, { tier: "asc" }]
    });

    return legacyPlans.map(getLegacyPlanPresentation);
  }
}

export async function createMembershipPlan(actorId: string, input: PlanInput) {
  let plan: MembershipPlanWithBenefits;
  try {
    plan = await prisma.$transaction(async (tx) => createOrUpdatePlanCore(tx, null, input));
  } catch (error) {
    mapMembershipPlanMutationError(error);
  }

  await logAudit({
    action: "MEMBERSHIP_PLAN_CREATE",
    entity: "MembershipPlan",
    entityId: plan.id,
    actorId,
    payload: {
      tier: plan.tier,
      durationMonths: plan.durationMonths,
      benefitsCount: plan.benefits.length
    }
  });

  return getPlanPresentation(plan);
}

export async function updateMembershipPlan(actorId: string, planId: string, input: PlanInput) {
  let plan: MembershipPlanWithBenefits;
  try {
    plan = await prisma.$transaction(async (tx) => createOrUpdatePlanCore(tx, planId, input));
  } catch (error) {
    mapMembershipPlanMutationError(error);
  }

  await logAudit({
    action: "MEMBERSHIP_PLAN_UPDATE",
    entity: "MembershipPlan",
    entityId: plan.id,
    actorId,
    payload: {
      tier: plan.tier,
      durationMonths: plan.durationMonths,
      benefitsCount: plan.benefits.length,
      isActive: plan.isActive
    }
  });

  return getPlanPresentation(plan);
}

export async function createMembershipRequest(customerId: string, planId: string) {
  const order = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.membershipOrder.findFirst({
        where: {
          customerId,
          status: {
            in: [MembershipOrderStatus.PENDING, MembershipOrderStatus.ACTIVE]
          }
        },
        select: { id: true }
      });

      if (existing) {
        throw new ApiError(
          409,
          "MEMBERSHIP_ALREADY_EXISTS",
          "You already have a pending/active membership request."
        );
      }

      const plan = await tx.membershipPlan.findUnique({
        where: { id: planId }
      });

      if (!plan || !plan.isActive) {
        throw new ApiError(404, "PLAN_NOT_FOUND", "Membership plan not found.");
      }

      return tx.membershipOrder.create({
        data: {
          customerId,
          planId: plan.id,
          priceSnapshot: plan.price,
          status: MembershipOrderStatus.PENDING,
          requestedAt: new Date(),
          startDate: null,
          endDate: null,
          expiresAt: null,
          approvedAt: null,
          rejectedAt: null
        }
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  await logAudit({
    action: "MEMBERSHIP_REQUEST_CREATE",
    entity: "MembershipOrder",
    entityId: order.id,
    actorId: customerId,
    payload: {
      planId: order.planId
    }
  });

  await createNotification({
    userId: customerId,
    title: "Membership Request Submitted",
    message: "Your membership request is pending admin approval.",
    type: NotificationType.MEMBERSHIP,
    metadata: { membershipOrderId: order.id }
  });

  return getMembershipForUser(customerId);
}

export async function getMembershipForUser(customerId: string) {
  const plans = await listMembershipPlans();
  try {
    const orders = await prisma.membershipOrder.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "desc" }, { requestedAt: "desc" }],
      select: {
        id: true,
        status: true
      }
    });

    const current = pickCurrentOrder(orders);
    if (current?.status === MembershipOrderStatus.ACTIVE) {
      await ensureOrderBenefitSnapshots(prisma, current.id);
    }

    const detailedOrder = current
      ? await prisma.membershipOrder.findUnique({
          where: { id: current.id },
          include: membershipOrderDetailInclude
        })
      : null;

    return {
      plans,
      currentSubscription: detailedOrder ? getSubscriptionPresentation(detailedOrder) : null
    };
  } catch (error) {
    if (!isMembershipSchemaCompatibilityError(error)) {
      throw error;
    }

    const legacyOrders = await prisma.membershipOrder.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        priceSnapshot: true,
        startDate: true,
        endDate: true,
        paidAt: true,
        createdAt: true,
        plan: {
          select: {
            id: true,
            tier: true,
            nameEn: true,
            nameAr: true,
            descriptionEn: true,
            descriptionAr: true,
            price: true,
            durationDays: true,
            isActive: true
          }
        }
      }
    });

    const current = pickCurrentOrder(
      legacyOrders.map((order) => ({
        id: order.id,
        status: mapLegacyMembershipStatus(String(order.status))
      }))
    );

    const currentLegacyOrder = current
      ? legacyOrders.find((order) => order.id === current.id) ?? null
      : null;

    return {
      plans,
      currentSubscription: currentLegacyOrder
        ? {
            id: currentLegacyOrder.id,
            status: mapLegacyMembershipStatus(String(currentLegacyOrder.status)),
            requestedAt: currentLegacyOrder.createdAt.toISOString(),
            approvedAt: currentLegacyOrder.paidAt?.toISOString() ?? currentLegacyOrder.startDate?.toISOString() ?? null,
            rejectedAt: null,
            expiresAt: currentLegacyOrder.endDate?.toISOString() ?? null,
            startDate: currentLegacyOrder.startDate?.toISOString() ?? null,
            endDate: currentLegacyOrder.endDate?.toISOString() ?? null,
            rejectionReason: null,
            priceSnapshot: toNumber(currentLegacyOrder.priceSnapshot),
            delivery: {
              deliveryCompanyName: null,
              deliveryPhone: null,
              deliveryTrackingCode: null,
              deliveryNote: null
            },
            customer: null,
            plan: getLegacyPlanPresentation(currentLegacyOrder.plan),
            benefitUsageSummary: {
              used: 0,
              total: 0
            },
            benefits: [],
            adminNotes: [],
            adminNotesCount: 0,
            approvedByAdmin: null,
            rejectedByAdmin: null
          }
        : null
    };
  }
}

export async function listAdminMembershipSubscriptions(input?: {
  status?: "pending" | "active" | "rejected" | "all";
  q?: string | null;
}) {
  const statusMap: Record<string, MembershipOrderStatus | undefined> = {
    pending: MembershipOrderStatus.PENDING,
    active: MembershipOrderStatus.ACTIVE,
    rejected: MembershipOrderStatus.REJECTED,
    all: undefined
  };

  const query = normalizeText(input?.q) ?? undefined;
  const status = statusMap[input?.status ?? "all"];
  const where: Prisma.MembershipOrderWhereInput = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { customer: { fullName: { contains: query } } },
            { customer: { phone: { contains: query } } },
            { plan: { nameEn: { contains: query } } },
            { plan: { nameAr: { contains: query } } }
          ]
        }
      : {})
  };

  try {
    const items = await prisma.membershipOrder.findMany({
      where,
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        },
        plan: {
          include: membershipPlanInclude
        },
        orderBenefits: {
          include: {
            uses: {
              select: { id: true }
            }
          }
        },
        adminNotes: {
          select: { id: true }
        }
      }
    });

    for (const item of items) {
      if (item.status === MembershipOrderStatus.ACTIVE && item.orderBenefits.length === 0) {
        await ensureOrderBenefitSnapshots(prisma, item.id);
      }
    }

    const refreshedItems = await prisma.membershipOrder.findMany({
      where,
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        },
        plan: {
          include: membershipPlanInclude
        },
        orderBenefits: {
          include: {
            uses: {
              select: { id: true }
            }
          }
        },
        adminNotes: {
          select: { id: true }
        }
      }
    });

    const counts = await prisma.membershipOrder.groupBy({
      by: ["status"],
      _count: { _all: true }
    });
    const pendingCount = await prisma.membershipOrder.count({
      where: { status: MembershipOrderStatus.PENDING }
    });

    return {
      items: refreshedItems.map((item) => {
        const used = item.orderBenefits.reduce((sum, benefit) => sum + benefit.uses.length, 0);
        const total = item.orderBenefits.reduce((sum, benefit) => sum + benefit.limitCount, 0);
        return {
          id: item.id,
          customer: {
            id: item.customer.id,
            fullName: item.customer.fullName,
            phone: item.customer.phone
          },
          plan: getPlanPresentation(item.plan),
          status: item.status,
          requestedAt: item.requestedAt.toISOString(),
          approvedAt: item.approvedAt?.toISOString() ?? null,
          rejectedAt: item.rejectedAt?.toISOString() ?? null,
          expiresAt: item.expiresAt?.toISOString() ?? item.endDate?.toISOString() ?? null,
          delivery: {
            deliveryCompanyName: item.deliveryCompanyName,
            deliveryPhone: item.deliveryPhone,
            deliveryTrackingCode: item.deliveryTrackingCode
          },
          rejectionReason: item.rejectionReason,
          adminNotesCount: item.adminNotes.length,
          usageSummary: {
            used,
            total
          }
        };
      }),
      meta: {
        pendingCount,
        countsByStatus: counts.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = row._count._all;
          return acc;
        }, {})
      }
    };
  } catch (error) {
    if (!isMembershipSchemaCompatibilityError(error)) {
      throw error;
    }

    const legacyItems = await prisma.membershipOrder.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        paidAt: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        },
        plan: {
          select: {
            id: true,
            tier: true,
            nameEn: true,
            nameAr: true,
            descriptionEn: true,
            descriptionAr: true,
            price: true,
            durationDays: true,
            isActive: true
          }
        }
      }
    });

    const filteredItems = legacyItems
      .map((item) => ({
        id: item.id,
        customer: item.customer,
        plan: getLegacyPlanPresentation(item.plan),
        status: mapLegacyMembershipStatus(String(item.status)),
        requestedAt: item.createdAt.toISOString(),
        approvedAt: item.paidAt?.toISOString() ?? item.startDate?.toISOString() ?? null,
        rejectedAt: null,
        expiresAt: item.endDate?.toISOString() ?? null,
        delivery: {
          deliveryCompanyName: null,
          deliveryPhone: null,
          deliveryTrackingCode: null
        },
        rejectionReason: null,
        adminNotesCount: 0,
        usageSummary: {
          used: 0,
          total: 0
        }
      }))
      .filter((item) => {
        if (input?.status === "pending") return false;
        if (input?.status === "active") return item.status === MembershipOrderStatus.ACTIVE;
        if (input?.status === "rejected") return item.status === MembershipOrderStatus.REJECTED;
        return true;
      })
      .filter((item) => {
        if (!query) return true;
        return (
          containsNormalized(item.customer.fullName, query) ||
          containsNormalized(item.customer.phone, query) ||
          containsNormalized(item.plan.nameEn, query) ||
          containsNormalized(item.plan.nameAr, query)
        );
      });

    const countsByStatus = legacyItems.reduce<Record<string, number>>((acc, item) => {
      const statusKey = mapLegacyMembershipStatus(String(item.status));
      acc[statusKey] = (acc[statusKey] ?? 0) + 1;
      return acc;
    }, {});

    return {
      items: filteredItems,
      meta: {
        pendingCount: 0,
        countsByStatus
      }
    };
  }
}

export async function getAdminMembershipSubscriptionDetail(membershipOrderId: string) {
  try {
    await ensureOrderBenefitSnapshots(prisma, membershipOrderId);
    const order = await getOrderDetailOrThrow(membershipOrderId);
    return {
      item: getSubscriptionPresentation(order)
    };
  } catch (error) {
    if (!isMembershipSchemaCompatibilityError(error)) {
      throw error;
    }

    const order = await prisma.membershipOrder.findUnique({
      where: { id: membershipOrderId },
      select: {
        id: true,
        status: true,
        priceSnapshot: true,
        startDate: true,
        endDate: true,
        paidAt: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        },
        plan: {
          select: {
            id: true,
            tier: true,
            nameEn: true,
            nameAr: true,
            descriptionEn: true,
            descriptionAr: true,
            price: true,
            durationDays: true,
            isActive: true
          }
        }
      }
    });

    if (!order) {
      throw new ApiError(404, "SUBSCRIPTION_NOT_FOUND", "Membership subscription not found.");
    }

    return {
      item: {
        id: order.id,
        status: mapLegacyMembershipStatus(String(order.status)),
        requestedAt: order.createdAt.toISOString(),
        approvedAt: order.paidAt?.toISOString() ?? order.startDate?.toISOString() ?? null,
        rejectedAt: null,
        expiresAt: order.endDate?.toISOString() ?? null,
        startDate: order.startDate?.toISOString() ?? null,
        endDate: order.endDate?.toISOString() ?? null,
        rejectionReason: null,
        priceSnapshot: toNumber(order.priceSnapshot),
        delivery: {
          deliveryCompanyName: null,
          deliveryPhone: null,
          deliveryTrackingCode: null,
          deliveryNote: null
        },
        customer: {
          id: order.customer.id,
          fullName: order.customer.fullName,
          phone: order.customer.phone
        },
        plan: getLegacyPlanPresentation(order.plan),
        benefitUsageSummary: {
          used: 0,
          total: 0
        },
        benefits: [],
        adminNotes: [],
        adminNotesCount: 0,
        approvedByAdmin: null,
        rejectedByAdmin: null
      }
    };
  }
}

export async function approveMembershipSubscription(
  actorId: string,
  membershipOrderId: string,
  input: DeliveryInput
) {
  const deliveryCompanyName = normalizeText(input.deliveryCompanyName);
  const deliveryPhone = normalizeText(input.deliveryPhone);
  const deliveryTrackingCode = normalizeText(input.deliveryTrackingCode);
  const deliveryNote = normalizeText(input.deliveryNote);

  if (!deliveryCompanyName && !deliveryPhone) {
    throw new ApiError(
      400,
      "DELIVERY_INFO_REQUIRED",
      "Either delivery company name or delivery phone is required."
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.membershipOrder.findUnique({
      where: { id: membershipOrderId },
      include: {
        customer: {
          select: {
            id: true
          }
        },
        plan: true
      }
    });

    if (!order) {
      throw new ApiError(404, "SUBSCRIPTION_NOT_FOUND", "Membership subscription not found.");
    }

    if (order.status !== MembershipOrderStatus.PENDING) {
      throw new ApiError(400, "SUBSCRIPTION_NOT_PENDING", "Only pending subscriptions can be approved.");
    }

    const approvedAt = new Date();
    const expiresAt = addMonths(
      approvedAt,
      getDurationMonths(order.plan.durationDays, order.plan.durationMonths)
    );

    const updatedOrder = await tx.membershipOrder.update({
      where: { id: membershipOrderId },
      data: {
        status: MembershipOrderStatus.ACTIVE,
        approvedAt,
        approvedByAdminId: actorId,
        rejectedAt: null,
        rejectedByAdminId: null,
        rejectionReason: null,
        deliveryCompanyName,
        deliveryPhone,
        deliveryTrackingCode,
        deliveryNote,
        startDate: approvedAt,
        expiresAt,
        endDate: expiresAt,
        paidAt: approvedAt
      }
    });

    const plan = await ensurePlanBenefitDefinitions(tx, order.planId);
    if (plan.benefits.length > 0) {
      const approvalBenefitRows = plan.benefits
        .filter((benefit) => benefit.isActive)
        .map((benefit) => ({
          membershipOrderId,
          planBenefitId: benefit.id,
          code: benefit.code,
          titleEn: benefit.titleEn,
          titleAr: benefit.titleAr,
          descriptionEn: benefit.descriptionEn,
          descriptionAr: benefit.descriptionAr,
          limitCount: benefit.limitCount,
          isActive: benefit.isActive
        }));

      await createManyWithOptionalSkipDuplicates(
        () =>
          tx.membershipOrderBenefit.createMany({
            data: approvalBenefitRows,
            skipDuplicates: true
          }),
        () =>
          tx.membershipOrderBenefit.createMany({
            data: approvalBenefitRows
          })
      );
    }

    await tx.transaction.create({
      data: {
        type: TransactionType.INCOME,
        incomeSource: IncomeSource.MEMBERSHIP,
        itemName: order.plan.nameEn,
        unitPrice: toNumber(order.plan.price),
        quantity: 1,
        amount: order.plan.price,
        description: `Membership subscription ${membershipOrderId}`,
        membershipOrderId,
        createdById: actorId,
        occurredAt: approvedAt,
        recordedAt: approvedAt
      }
    });

    return {
      orderId: updatedOrder.id,
      customerId: order.customer.id,
      expiresAt
    };
  });

  await logAudit({
    action: "MEMBERSHIP_REQUEST_APPROVE",
    entity: "MembershipOrder",
    entityId: result.orderId,
    actorId,
    payload: {
      deliveryCompanyName,
      deliveryPhone,
      deliveryTrackingCode
    }
  });

  await createNotification({
    userId: result.customerId,
    title: "Membership Approved",
    message: `Your membership is now active and valid until ${result.expiresAt.toISOString()}.`,
    type: NotificationType.MEMBERSHIP,
    metadata: { membershipOrderId: result.orderId }
  });

  return getAdminMembershipSubscriptionDetail(result.orderId);
}

export async function rejectMembershipSubscription(
  actorId: string,
  membershipOrderId: string,
  rejectionReasonInput: string
) {
  const rejectionReason = normalizeText(rejectionReasonInput);
  if (!rejectionReason) {
    throw new ApiError(400, "REJECTION_REASON_REQUIRED", "Rejection reason is required.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.membershipOrder.findUnique({
      where: { id: membershipOrderId },
      select: {
        id: true,
        customerId: true,
        status: true
      }
    });

    if (!order) {
      throw new ApiError(404, "SUBSCRIPTION_NOT_FOUND", "Membership subscription not found.");
    }

    if (order.status !== MembershipOrderStatus.PENDING) {
      throw new ApiError(400, "SUBSCRIPTION_NOT_PENDING", "Only pending subscriptions can be rejected.");
    }

    await tx.membershipOrder.update({
      where: { id: membershipOrderId },
      data: {
        status: MembershipOrderStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedByAdminId: actorId,
        rejectionReason
      }
    });

    return order;
  });

  await logAudit({
    action: "MEMBERSHIP_REQUEST_REJECT",
    entity: "MembershipOrder",
    entityId: result.id,
    actorId,
    payload: {
      rejectionReason
    }
  });

  await createNotification({
    userId: result.customerId,
    title: "Membership Rejected",
    message: rejectionReason,
    type: NotificationType.MEMBERSHIP,
    metadata: { membershipOrderId: result.id }
  });

  return getAdminMembershipSubscriptionDetail(result.id);
}

export async function confirmMembershipBenefitUse(
  actorId: string,
  membershipOrderId: string,
  benefitId: string,
  confirmNoteInput?: string | null
) {
  const confirmNote = normalizeText(confirmNoteInput);

  const use = await prisma.$transaction(
    async (tx) => {
      await ensureOrderBenefitSnapshots(tx, membershipOrderId);

      const benefit = await tx.membershipOrderBenefit.findUnique({
        where: { id: benefitId },
        include: {
          membershipOrder: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      if (!benefit || benefit.membershipOrderId !== membershipOrderId) {
        throw new ApiError(404, "BENEFIT_NOT_FOUND", "Membership benefit not found.");
      }

      if (benefit.membershipOrder.status !== MembershipOrderStatus.ACTIVE) {
        throw new ApiError(400, "SUBSCRIPTION_NOT_ACTIVE", "Only active subscriptions can use benefits.");
      }

      const usedCount = await tx.membershipBenefitUse.count({
        where: {
          membershipOrderId,
          membershipOrderBenefitId: benefitId
        }
      });

      if (usedCount >= benefit.limitCount) {
        throw new ApiError(409, "BENEFIT_LIMIT_REACHED", "Benefit limit reached");
      }

      return tx.membershipBenefitUse.create({
        data: {
          membershipOrderId,
          membershipOrderBenefitId: benefitId,
          usedByAdminId: actorId,
          confirmNote
        }
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  await logAudit({
    action: "MEMBERSHIP_BENEFIT_CONFIRM",
    entity: "MembershipBenefitUse",
    entityId: use.id,
    actorId,
    payload: {
      membershipOrderId,
      benefitId
    }
  });

  return getAdminMembershipSubscriptionDetail(membershipOrderId);
}

export async function appendMembershipAdminNote(
  actorId: string,
  membershipOrderId: string,
  noteInput: string
) {
  const note = normalizeText(noteInput);
  if (!note) {
    throw new ApiError(400, "NOTE_REQUIRED", "Note is required.");
  }

  const created = await prisma.membershipAdminNote.create({
    data: {
      membershipOrderId,
      note,
      createdByAdminId: actorId
    }
  });

  await logAudit({
    action: "MEMBERSHIP_ADMIN_NOTE_CREATE",
    entity: "MembershipAdminNote",
    entityId: created.id,
    actorId,
    payload: {
      membershipOrderId
    }
  });

  return getAdminMembershipSubscriptionDetail(membershipOrderId);
}
