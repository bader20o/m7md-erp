import { Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createTaskSchema } from "@/lib/validators/task";

export async function POST(request: Request): Promise<Response> {
  try {
    const session = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, createTaskSchema);

    const assignedUser = await prisma.user.findUnique({
      where: { id: body.assignedToId },
      select: { id: true, role: true, isActive: true, fullName: true, phone: true, avatarUrl: true }
    });

    if (!assignedUser || assignedUser.role !== Role.EMPLOYEE || !assignedUser.isActive) {
      throw new ApiError(400, "INVALID_ASSIGNEE", "assignedToId must reference an active employee user.");
    }

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        priority: body.priority,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        assignedToId: body.assignedToId,
        createdById: session.sub
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
        createdBy: { select: { id: true, fullName: true, phone: true } }
      }
    });

    await logAudit({
      action: "TASK_CREATED",
      entity: "Task",
      entityId: task.id,
      actorId: session.sub,
      payload: {
        assignedToId: task.assignedToId,
        title: task.title,
        priority: task.priority
      }
    });

    return ok({ item: task }, 201);
  } catch (error) {
    return fail(error);
  }
}
