import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function ensureDefaultAdminUser(phone: string): Promise<void> {
  const adminPhone = process.env.DEFAULT_ADMIN_PHONE?.trim();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  const adminName = process.env.DEFAULT_ADMIN_NAME?.trim() || "System Admin";

  if (!adminPhone || !adminPassword || phone !== adminPhone) {
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { phone: adminPhone },
    select: { id: true }
  });

  if (existing) {
    return;
  }

  await prisma.user.create({
    data: {
      phone: adminPhone,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      fullName: adminName,
      role: Role.ADMIN,
      isActive: true
    }
  });
}
