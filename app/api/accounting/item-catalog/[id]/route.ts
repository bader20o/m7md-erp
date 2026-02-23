import { Prisma, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { updateItemCatalogSchema } from "@/lib/validators/accounting";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateItemCatalogSchema);

    const item = await prisma.itemCatalog.update({
      where: { id },
      data: {
        ...(body.itemName !== undefined ? { itemName: body.itemName } : {}),
        ...(body.defaultUnitPrice !== undefined
          ? { defaultUnitPrice: body.defaultUnitPrice }
          : {}),
        ...(body.category !== undefined ? { category: body.category || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });

    return ok({
      item: {
        ...item,
        defaultUnitPrice: Number(item.defaultUnitPrice)
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail(new ApiError(404, "ITEM_CATALOG_NOT_FOUND", "Catalog item not found."));
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new ApiError(409, "ITEM_CATALOG_DUPLICATE", "Catalog item already exists."));
    }
    return fail(error);
  }
}

export async function DELETE(_: Request, context: Params): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const { id } = await context.params;

    await prisma.itemCatalog.update({
      where: { id },
      data: { isActive: false }
    });

    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail(new ApiError(404, "ITEM_CATALOG_NOT_FOUND", "Catalog item not found."));
    }
    return fail(error);
  }
}

