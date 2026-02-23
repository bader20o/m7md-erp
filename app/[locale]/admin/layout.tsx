import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({ children, params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const allowedRoles: Role[] = [Role.EMPLOYEE, Role.EMPLOYEE, Role.EMPLOYEE, Role.ADMIN];
  const allowed = allowedRoles.includes(session.role);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Access denied. You need an admin role to view this section.
      </div>
    );
  }

  return <>{children}</>;
}
