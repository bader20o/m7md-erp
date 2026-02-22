import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminIndexPage({ params }: Props): Promise<never> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if (session.role === Role.ACCOUNTANT) {
    redirect(`/${locale}/admin/transactions`);
  }

  redirect(`/${locale}/admin/bookings`);
}
