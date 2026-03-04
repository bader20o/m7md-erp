import { subDays } from "date-fns";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const MAX_ITEMS = 8;

function getPrimaryCarType(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const first = parsed.map((value) => String(value).trim().toUpperCase()).find(Boolean);
      return first ?? null;
    }
  } catch {
    // Fall back to comma-delimited values.
  }

  const first = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .find(Boolean);

  return first ?? null;
}

export async function GET(): Promise<Response> {
  try {
    const since = subDays(new Date(), 90);

    const [recentCounts, allTimeCounts, activeServices] = await Promise.all([
      prisma.booking.groupBy({
        by: ["serviceId"],
        where: {
          appointmentAt: { gte: since },
          service: { isActive: true }
        },
        _count: { serviceId: true },
        orderBy: { _count: { serviceId: "desc" } },
        take: MAX_ITEMS * 3
      }),
      prisma.booking.groupBy({
        by: ["serviceId"],
        where: {
          service: { isActive: true }
        },
        _count: { serviceId: true },
        orderBy: { _count: { serviceId: "desc" } },
        take: MAX_ITEMS * 3
      }),
      prisma.service.findMany({
        where: { isActive: true },
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          descriptionEn: true,
          descriptionAr: true,
          basePrice: true,
          priceType: true,
          durationMinutes: true,
          supportedCarTypes: true,
          imageUrl: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ITEMS * 3
      })
    ]);

    const serviceMap = new Map(activeServices.map((service) => [service.id, service]));
    const rankedIds: string[] = [];

    for (const group of recentCounts) {
      if (serviceMap.has(group.serviceId) && !rankedIds.includes(group.serviceId)) {
        rankedIds.push(group.serviceId);
      }
    }

    for (const group of allTimeCounts) {
      if (serviceMap.has(group.serviceId) && !rankedIds.includes(group.serviceId)) {
        rankedIds.push(group.serviceId);
      }
    }

    for (const service of activeServices) {
      if (!rankedIds.includes(service.id)) {
        rankedIds.push(service.id);
      }
    }

    const items = rankedIds
      .slice(0, MAX_ITEMS)
      .map((id) => serviceMap.get(id))
      .filter((service): service is NonNullable<typeof service> => Boolean(service))
      .map((service) => ({
        id: service.id,
        title: service.nameEn,
        titleAr: service.nameAr,
        description: service.descriptionEn,
        descriptionAr: service.descriptionAr,
        price: service.basePrice?.toString() ?? null,
        priceType: service.priceType,
        durationMinutes: service.durationMinutes,
        carType: getPrimaryCarType(service.supportedCarTypes),
        imageUrl: service.imageUrl
      }));

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}
