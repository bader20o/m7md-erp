import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const createThreadSchema = z.object({
  participantUserIds: z.array(z.string().min(1)).max(1).optional(),
  subject: z.string().max(160).optional()
});

type ThreadWithParticipants = Prisma.ChatThreadGetPayload<{ include: { participants: true } }>;

async function findExistingSupportThread(customerId: string): Promise<{ id: string } | null> {
  return prisma.chatThread.findFirst({
    where: {
      participants: {
        some: { userId: customerId }
      },
      AND: [
        {
          participants: {
            some: {
              user: { role: Role.ADMIN }
            }
          }
        }
      ]
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" }
  });
}

async function addAdminParticipantIfMissing(threadId: string, adminUserId: string): Promise<void> {
  const adminMembership = await prisma.chatParticipant.findUnique({
    where: {
      threadId_userId: {
        threadId,
        userId: adminUserId
      }
    },
    select: { id: true }
  });

  if (!adminMembership) {
    await prisma.chatParticipant.create({
      data: {
        threadId,
        userId: adminUserId
      }
    });
  }
}

async function getThreadWithParticipants(threadId: string): Promise<ThreadWithParticipants | null> {
  return prisma.chatThread.findUnique({
    where: { id: threadId },
    include: { participants: true }
  });
}

export async function GET(): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const threadVisibilityWhere =
      actor.role === Role.ADMIN
        ? { userId: actor.sub }
        : {
            userId: actor.sub,
            thread: {
              participants: {
                some: {
                  user: { role: Role.ADMIN }
                }
              }
            }
          };

    const items = await prisma.chatParticipant.findMany({
      where: threadVisibilityWhere,
      include: {
        thread: {
          include: {
            participants: { include: { user: { select: { id: true, fullName: true, phone: true, role: true } } } },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                sender: { select: { id: true, fullName: true, phone: true, role: true } }
              }
            },
            _count: {
              select: {
                messages: {
                  where: {
                    senderId: { not: actor.sub },
                    seenBy: { none: { userId: actor.sub } }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { thread: { updatedAt: "desc" } }
    });

    const mappedItems = items.map((item) => ({
        id: item.thread.id,
        subject: item.thread.subject,
        createdAt: item.thread.createdAt,
        updatedAt: item.thread.updatedAt,
        participants: item.thread.participants,
        latestMessage: item.thread.messages[0] ?? null,
        unreadCount: item.thread._count.messages
      }));

    const dedupedByParticipants = new Map<string, (typeof mappedItems)[number]>();
    for (const item of mappedItems) {
      const participantKey = item.participants
        .map((participant) => participant.userId)
        .sort()
        .join(":");

      const existing = dedupedByParticipants.get(participantKey);
      if (!existing) {
        dedupedByParticipants.set(participantKey, item);
        continue;
      }

      existing.unreadCount += item.unreadCount;
      if (
        item.latestMessage &&
        (!existing.latestMessage ||
          new Date(item.latestMessage.createdAt).getTime() > new Date(existing.latestMessage.createdAt).getTime())
      ) {
        existing.latestMessage = item.latestMessage;
      }
    }

    const dedupedItems = Array.from(dedupedByParticipants.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return ok({ items: dedupedItems });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const body = await parseJsonBody(request, createThreadSchema);

    let participantUserIds = body.participantUserIds ?? [];

    if (actor.role === Role.CUSTOMER && participantUserIds.length === 0) {
      const fallbackAdmin = await prisma.user.findFirst({
        where: {
          role: Role.ADMIN,
          isActive: true
        },
        select: { id: true },
        orderBy: { createdAt: "asc" }
      });
      if (!fallbackAdmin) {
        throw new ApiError(503, "ADMIN_UNAVAILABLE", "No admin is available for chat.");
      }
      participantUserIds = [fallbackAdmin.id];
    }

    const uniqueParticipants = Array.from(new Set([...participantUserIds, actor.sub]));
    if (participantUserIds.length !== 1 || uniqueParticipants.length !== 2) {
      throw new ApiError(400, "THREAD_PARTICIPANTS_INVALID", "Thread must include exactly one other participant.");
    }

    const otherUserId = uniqueParticipants.find((userId) => userId !== actor.sub);
    if (!otherUserId) {
      throw new ApiError(400, "THREAD_PARTICIPANTS_INVALID", "You cannot start a conversation with yourself.");
    }

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueParticipants }, isActive: true },
      select: { id: true, role: true }
    });

    if (users.length !== uniqueParticipants.length) {
      throw new ApiError(400, "INVALID_PARTICIPANTS", "All participants must be active users.");
    }

    const nonAdminParticipants = users.filter((user) => user.role !== Role.ADMIN);
    const customerId =
      actor.role === Role.ADMIN ? nonAdminParticipants[0]?.id ?? null : actor.sub;

    if (actor.role === Role.ADMIN) {
      if (nonAdminParticipants.length !== 1) {
        throw new ApiError(
          400,
          "SUPPORT_THREAD_CUSTOMER_REQUIRED",
          "Admin must select exactly one customer for a support conversation."
        );
      }
    }

    if (actor.role !== Role.ADMIN) {
      const nonActorParticipants = users.filter((user) => user.id !== actor.sub);
      const allAdmins = nonActorParticipants.every((user) => user.role === Role.ADMIN);
      if (!allAdmins) {
        throw new ApiError(403, "FORBIDDEN", "You can only start conversations with center admins.");
      }
    }

    if (!customerId) {
      throw new ApiError(400, "SUPPORT_THREAD_CUSTOMER_REQUIRED", "Customer participant is required.");
    }

    const existingByKey = await prisma.chatThread.findUnique({
      where: { directKey: customerId },
      select: { id: true }
    });
    if (existingByKey) {
      if (actor.role === Role.ADMIN) {
        await addAdminParticipantIfMissing(existingByKey.id, actor.sub);
      }

      const existingThread = await getThreadWithParticipants(existingByKey.id);
      if (existingThread) {
        return ok({ item: existingThread, existing: true });
      }
    }

    const existing = await findExistingSupportThread(customerId);
    if (existing) {
      if (actor.role === Role.ADMIN) {
        await addAdminParticipantIfMissing(existing.id, actor.sub);
      }

      await prisma.chatThread.updateMany({
        where: { id: existing.id, directKey: null },
        data: { directKey: customerId }
      });

      const existingThread = await getThreadWithParticipants(existing.id);
      if (existingThread) {
        return ok({ item: existingThread, existing: true });
      }
    }

    let item: ThreadWithParticipants | null = null;
    try {
      item = await prisma.$transaction(async (tx) =>
        tx.chatThread.create({
          data: {
            directKey: customerId,
            subject: body.subject,
            participants: {
              createMany: {
                data: uniqueParticipants.map((userId) => ({ userId }))
              }
            }
          },
          include: {
            participants: true
          }
        })
      );
    } catch (error) {
      const isDirectKeyConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (Array.isArray(error.meta?.target)
          ? error.meta.target.includes("directKey")
          : typeof error.meta?.target === "string"
            ? error.meta.target.includes("directKey")
            : false);

      if (!isDirectKeyConflict) {
        throw error;
      }

      const conflictedThread = await prisma.chatThread.findUnique({
        where: { directKey: customerId },
        select: { id: true }
      });

      if (!conflictedThread) {
        throw error;
      }

      if (actor.role === Role.ADMIN) {
        await addAdminParticipantIfMissing(conflictedThread.id, actor.sub);
      }

      item = await getThreadWithParticipants(conflictedThread.id);
      if (!item) {
        throw error;
      }
    }

    if (!item) {
      throw new ApiError(500, "THREAD_CREATE_FAILED", "Failed to create or load conversation thread.");
    }

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}
