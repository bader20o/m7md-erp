import { Role } from "@prisma/client";
import { UserRoleManager } from "@/components/admin/user-role-manager";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminUsersPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 300
  });

  const serialized = users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    locale: user.locale,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString()
  }));

  return (
    <UserRoleManager
      users={serialized}
      locale={locale}
      canEditRoles={session?.role === Role.ADMIN}
    />
  );
}
