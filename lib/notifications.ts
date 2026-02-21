import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: unknown;
};

export async function createNotification(input: NotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? NotificationType.GENERAL,
      metadata: input.metadata as object | undefined
    }
  });
}

