import { Prisma, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

type ThreadWithParticipants = Prisma.ChatThreadGetPayload<{
  include: {
    participants: {
      include: {
        user: {
          select: { role: true };
        };
      };
    };
  };
}>;

function toParticipantKey(thread: ThreadWithParticipants): string {
  return thread.participants
    .map((participant) => participant.userId)
    .sort()
    .join(":");
}

async function dedupeParticipantSets(): Promise<number> {
  const threads = await prisma.chatThread.findMany({
    include: {
      participants: {
        include: {
          user: {
            select: { role: true }
          }
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  const groups = new Map<string, ThreadWithParticipants[]>();
  for (const thread of threads) {
    const key = toParticipantKey(thread);
    const group = groups.get(key) ?? [];
    group.push(thread);
    groups.set(key, group);
  }

  let mergedCount = 0;
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const canonical = group[0];
    const duplicates = group.slice(1);
    const canonicalParticipantIds = new Set(canonical.participants.map((participant) => participant.userId));

    await prisma.$transaction(async (tx) => {
      for (const duplicate of duplicates) {
        const missingParticipants = duplicate.participants
          .map((participant) => participant.userId)
          .filter((userId) => !canonicalParticipantIds.has(userId));

        if (missingParticipants.length > 0) {
          await tx.chatParticipant.createMany({
            data: missingParticipants.map((userId) => ({
              threadId: canonical.id,
              userId
            })),
            skipDuplicates: true
          });

          for (const userId of missingParticipants) {
            canonicalParticipantIds.add(userId);
          }
        }

        await tx.chatMessage.updateMany({
          where: { threadId: duplicate.id },
          data: { threadId: canonical.id }
        });

        await tx.chatParticipant.deleteMany({
          where: { threadId: duplicate.id }
        });

        await tx.chatThread.delete({
          where: { id: duplicate.id }
        });
      }

      await tx.chatThread.update({
        where: { id: canonical.id },
        data: { updatedAt: new Date() }
      });
    });

    mergedCount += duplicates.length;
  }

  return mergedCount;
}

async function backfillSupportKeys(): Promise<number> {
  const threads = await prisma.chatThread.findMany({
    include: {
      participants: {
        include: {
          user: {
            select: { role: true }
          }
        }
      }
    }
  });

  let updatedCount = 0;
  for (const thread of threads) {
    const nonAdminParticipants = thread.participants.filter((participant) => participant.user.role !== Role.ADMIN);
    if (nonAdminParticipants.length !== 1) {
      continue;
    }

    const customerId = nonAdminParticipants[0].userId;
    try {
      const result = await prisma.chatThread.updateMany({
        where: { id: thread.id, directKey: null },
        data: { directKey: customerId }
      });
      updatedCount += result.count;
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
    }
  }

  return updatedCount;
}

async function main(): Promise<void> {
  const mergedCount = await dedupeParticipantSets();
  const keyedCount = await backfillSupportKeys();
  console.log(`Merged duplicate threads: ${mergedCount}`);
  console.log(`Backfilled support keys: ${keyedCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
