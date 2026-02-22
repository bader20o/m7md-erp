import { Prisma, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createPartSchema, listPartsQuerySchema } from "@/lib/validators/inventory";

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);
    const url = new URL(request.url);
    const query = await listPartsQuerySchema.parseAsync({
      q: url.searchParams.get("q") ?? undefined,
      includeInactive: url.searchParams.get("includeInactive") ?? undefined
    });

    const q = query.q?.trim();
    const items = await prisma.part.findMany({
      where: {
        isActive: query.includeInactive ? undefined : true,
        OR: q
          ? [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: [{ name: "asc" }]
    });

    return ok({
      items: items.map((part) => ({
        ...part,
        lowStock: isLowStock(part.stockQty, part.lowStockThreshold)
      }))
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, createPartSchema);

    const item = await prisma.part.create({
      data: {
        name: body.name,
        sku: body.sku ?? null,
        unit: body.unit,
        costPrice: body.costPrice,
        sellPrice: body.sellPrice,
        stockQty: body.stockQty,
        lowStockThreshold: body.lowStockThreshold,
        isActive: body.isActive
      }
    });

    return ok(
      {
        item: {
          ...item,
          lowStock: isLowStock(item.stockQty, item.lowStockThreshold)
        }
      },
      201
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new ApiError(409, "SKU_ALREADY_EXISTS", "SKU already exists."));
    }
    return fail(error);
  }
}
