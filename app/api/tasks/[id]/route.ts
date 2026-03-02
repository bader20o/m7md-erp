import { Role, TaskStatus } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { adminUpdateTaskSchema, employeeUpdateTaskSchema } from "@/lib/validators/task";

type Params = { params: Promise<{ id: string }> };

function isTerminalTaskStatus(status: TaskStatus): boolean {
  return status === TaskStatus.DONE || status === TaskStatus.BLOCKED;
}

function deriveCompletedAt(nextStatus: TaskStatus, previousStatus: TaskStatus, existing: Date | null): Date | null {
  if (nextStatus === TaskStatus.DONE) {
    return previousStatus === TaskStatus.DONE && existing ? existing : new Date();
  }

  if (previousStatus === TaskStatus.DONE) {
    return null;
  }

  return existing;
}

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const session = requireRoles(await getSession(), [Role.ADMIN, Role.EMPLOYEE]);
    const { id } = await context.params;
    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
    }

    if (session.role === Role.EMPLOYEE && task.assignedToId !== session.sub) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission for this task.");
    }

    if (session.role === Role.EMPLOYEE) {
      if (isTerminalTaskStatus(task.status)) {
        throw new ApiError(403, "TASK_LOCKED", "Completed or cancelled tasks cannot be changed by employees.");
      }

      const body = await parseJsonBody(request, employeeUpdateTaskSchema);
      const nextStatus = body.status ?? task.status;
      const updated = await prisma.task.update({
        where: { id },
        data: {
          status: nextStatus,
          employeeNote: body.employeeNote === undefined ? task.employeeNote : body.employeeNote,
          completedAt: deriveCompletedAt(nextStatus, task.status, task.completedAt)
        },
        include: {
          assignedTo: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
          createdBy: { select: { id: true, fullName: true, phone: true } }
        }
      });

      await logAudit({
        action: "TASK_EMPLOYEE_UPDATED",
        entity: "Task",
        entityId: updated.id,
        actorId: session.sub,
        payload: {
          status: updated.status,
          employeeNote: updated.employeeNote
        }
      });

      return ok({ item: updated });
    }

    const body = await parseJsonBody(request, adminUpdateTaskSchema);
    const requiresAdminPassword = isTerminalTaskStatus(task.status);

    if (requiresAdminPassword) {
      if (!body.adminPassword) {
        throw new ApiError(
          403,
          "ADMIN_PASSWORD_REQUIRED",
          "Admin password is required to change a completed or cancelled task."
        );
      }

      const admin = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { passwordHash: true }
      });

      if (!admin || !(await verifyPassword(body.adminPassword, admin.passwordHash))) {
        throw new ApiError(403, "ADMIN_PASSWORD_INVALID", "Admin password is incorrect.");
      }
    }

    if (body.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: body.assignedToId },
        select: { id: true, role: true, isActive: true }
      });

      if (!assignedUser || assignedUser.role !== Role.EMPLOYEE || !assignedUser.isActive) {
        throw new ApiError(400, "INVALID_ASSIGNEE", "assignedToId must reference an active employee user.");
      }
    }

    if (body.createdById) {
      const creator = await prisma.user.findUnique({
        where: { id: body.createdById },
        select: { id: true, role: true }
      });

      if (!creator || creator.role !== Role.ADMIN) {
        throw new ApiError(400, "INVALID_CREATOR", "createdById must reference an admin user.");
      }
    }

    const nextStatus = body.status ?? task.status;
    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: nextStatus,
        dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null,
        assignedToId: body.assignedToId,
        createdById: body.createdById,
        employeeNote: body.employeeNote,
        adminNote: body.adminNote,
        completedAt: deriveCompletedAt(nextStatus, task.status, task.completedAt)
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
        createdBy: { select: { id: true, fullName: true, phone: true } }
      }
    });

    await logAudit({
      action: "TASK_ADMIN_UPDATED",
      entity: "Task",
      entityId: updated.id,
      actorId: session.sub,
      payload: {
        ...body,
        adminPassword: body.adminPassword ? "[REDACTED]" : undefined
      }
    });

    return ok({ item: updated });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: Params): Promise<Response> {
  try {
    const session = requireRoles(await getSession(), [Role.ADMIN]);
    const { id } = await context.params;
    const task = await prisma.task.findUnique({ where: { id }, select: { id: true, status: true } });

    if (!task) {
      throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
    }

    if (isTerminalTaskStatus(task.status)) {
      throw new ApiError(
        403,
        "ADMIN_PASSWORD_REQUIRED",
        "Completed or cancelled tasks can only be deleted after password-confirmed editing."
      );
    }

    await prisma.task.delete({ where: { id } });
    await logAudit({
      action: "TASK_DELETED",
      entity: "Task",
      entityId: id,
      actorId: session.sub
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
