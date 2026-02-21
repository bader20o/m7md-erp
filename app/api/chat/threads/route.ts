import { z } from "zod";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const createThreadSchema = z.object({
  participantUserIds: z.array(z.string().min(1)).min(1),
  subject: z.string().max(160).optional()
});

export async function GET(): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const items = await prisma.chatParticipant.findMany({
      where: { userId: actor.sub },
      include: {
        thread: {
          include: {
            participants: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }
      },
      orderBy: { thread: { updatedAt: "desc" } }
    });

    return ok({ items: items.map((item) => item.thread) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireSession(await getSession());
    const body = await parseJsonBody(request, createThreadSchema);

    const uniqueParticipants = Array.from(new Set([...body.participantUserIds, actor.sub]));

    const item = await prisma.chatThread.create({
      data: {
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
    });

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}

