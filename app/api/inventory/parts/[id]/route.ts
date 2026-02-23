import { Prisma, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { updatePartSchema } from "@/lib/validators/inventory";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, updatePartSchema);
    const { id } = await context.params;

    const item = await prisma.part.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sku !== undefined ? { sku: body.sku ?? null } : {}),
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

    return ok({
      item: {
        ...item,
        lowStock: isLowStock(item.stockQty, item.lowStockThreshold)
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail(new ApiError(404, "PART_NOT_FOUND", "Part not found."));
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new ApiError(409, "SKU_ALREADY_EXISTS", "SKU already exists."));
    }
    return fail(error);
  }
}
