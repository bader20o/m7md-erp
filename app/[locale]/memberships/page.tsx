import { redirect } from "next/navigation";
import { CustomerMembershipsManager } from "@/components/memberships/customer-memberships-manager";
import { getSession } from "@/lib/auth";
import { getMembershipForUser } from "@/lib/memberships/subscriptions";

type Props = { params: Promise<{ locale: string }> };

export default async function MembershipsPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const membership = await getMembershipForUser(session.sub);

  return (
    <CustomerMembershipsManager
      locale={locale}
      plans={membership.plans}
      currentSubscription={membership.currentSubscription}
    />
  );
}
