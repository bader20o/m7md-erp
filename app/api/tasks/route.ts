import { Prisma, Role, TaskStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

function buildSearchWhere(searchParams: URLSearchParams, userId: string, role: Role): Prisma.TaskWhereInput {
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q")?.trim();
  const assignedToId = searchParams.get("assignedToId");
  const validStatuses = new Set<string>(Object.values(TaskStatus));

  const where: Prisma.TaskWhereInput = role === Role.ADMIN ? {} : { assignedToId: userId };

  if (role === Role.ADMIN && assignedToId) {
    where.assignedToId = assignedToId;
  }

  if (status && validStatuses.has(status)) {
    where.status = status as TaskStatus;
  }

  if (from || to) {
    where.dueAt = {};
    if (from) {
      where.dueAt.gte = new Date(from);
    }
    if (to) {
      where.dueAt.lte = new Date(to);
    }
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } }
    ];
  }

  return where;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = requireRoles(await getSession(), [Role.ADMIN, Role.EMPLOYEE]);
    const { searchParams } = new URL(request.url);
    const where = buildSearchWhere(searchParams, session.sub, session.role);

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatarUrl: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { updatedAt: "desc" }]
    });

    return ok({ items: tasks });
  } catch (error) {
    return fail(error);
  }
}
