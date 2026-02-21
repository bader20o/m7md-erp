import { Role } from "@prisma/client";
import { AdminSidebar } from "@/components/admin-sidebar";
import { getSession } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({ children, params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();
  const allowedRoles: Role[] = [Role.RECEPTION, Role.ACCOUNTANT, Role.MANAGER, Role.ADMIN];

  const allowed = Boolean(session && allowedRoles.includes(session.role));

  if (!allowed) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Access denied. You need an admin role to view this section.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <AdminSidebar locale={locale} />
      <div>{children}</div>
    </div>
  );
}
