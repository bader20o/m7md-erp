import { Prisma } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { updatePartSchema } from "@/lib/validators/inventory";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    await requireAnyPermission(await getSession(), ["warehouse"]);
    const body = await parseJsonBody(request, updatePartSchema);
    const { id } = await context.params;

    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.part.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          vehicleModel: true,
          category: true
        }
      });
      if (!current) {
        throw new ApiError(404, "PART_NOT_FOUND", "Part not found.");
      }

      const updated = await tx.part.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.sku !== undefined ? { sku: body.sku ?? null } : {}),
          ...(body.vehicleModel !== undefined ? { vehicleModel: body.vehicleModel ?? null } : {}),
          ...(body.vehicleType !== undefined ? { vehicleType: body.vehicleType ?? null } : {}),
          ...(body.category !== undefined ? { category: body.category ?? null } : {}),
          ...(body.unit !== undefined ? { unit: body.unit } : {}),
          ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
          ...(body.sellPrice !== undefined ? { sellPrice: body.sellPrice } : {}),
          ...(body.stockQty !== undefined ? { stockQty: body.stockQty } : {}),
          ...(body.lowStockThreshold !== undefined
            ? { lowStockThreshold: body.lowStockThreshold }
            : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
        }
      });

      const duplicateWhere: Prisma.PartWhereInput = {
        id: { not: id },
        name: { equals: updated.name, mode: "insensitive" },
        ...(updated.vehicleModel
          ? { vehicleModel: { equals: updated.vehicleModel, mode: "insensitive" } }
          : { vehicleModel: null }),
        ...(updated.category
          ? { category: { equals: updated.category, mode: "insensitive" } }
          : { category: null })
      };

      const duplicateCount = await tx.part.count({ where: duplicateWhere });

      return {
        item: updated,
        warning:
          duplicateCount > 0
            ? {
                code: "DUPLICATE_PART_COMBINATION",
                message:
                  "A part with the same name, vehicle model, and category already exists."
              }
            : null
      };
    });

    return ok({
      item: {
        ...item.item,
        lowStock: isLowStock(item.item.stockQty, item.item.lowStockThreshold)
      },
      warnings: item.warning ? [item.warning] : []
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new ApiError(409, "SKU_ALREADY_EXISTS", "SKU already exists."));
    }
    return fail(error);
  }
}
