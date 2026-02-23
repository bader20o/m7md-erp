import { Prisma, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createItemCatalogSchema } from "@/lib/validators/accounting";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);

    const items = await prisma.itemCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ itemName: "asc" }, { createdAt: "desc" }]
    });

    return ok({
      items: items.map((item) => ({
        ...item,
        defaultUnitPrice: Number(item.defaultUnitPrice)
      }))
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, createItemCatalogSchema);

    const item = await prisma.itemCatalog.create({
      data: {
        itemName: body.itemName,
        defaultUnitPrice: body.defaultUnitPrice,
        category: body.category || null,
        isActive: body.isActive
      }
    });

    return ok(
      {
        item: {
          ...item,
          defaultUnitPrice: Number(item.defaultUnitPrice)
        }
      },
      201
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new ApiError(409, "ITEM_CATALOG_DUPLICATE", "Catalog item already exists."));
    }
    return fail(error);
  }
}

