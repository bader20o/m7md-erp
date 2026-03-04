import { Role } from "@prisma/client";
import { MembershipPlanManager } from "@/components/admin/membership-plan-manager";
import { getSession } from "@/lib/auth";
import { listMembershipPlans } from "@/lib/memberships/subscriptions";
import { getPermissionsForUser } from "@/lib/rbac";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminMembershipsPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        You must be logged in to view membership plans.
      </section>
    );
  }

  if (session.role === Role.EMPLOYEE) {
    const permissions = await getPermissionsForUser(session.sub, session.role);
    if (!permissions.includes("memberships")) {
      return (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          You do not have permission to manage memberships.
        </section>
      );
    }
  }

  const plans = await listMembershipPlans({ includeInactive: true });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "خطط العضوية" : "Membership Plans"}</h1>
      <MembershipPlanManager locale={locale} initialPlans={plans} />
    </section>
  );
}
