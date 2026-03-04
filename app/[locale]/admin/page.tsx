import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminIndexPage({ params }: Props): Promise<never> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if (session.role === Role.EMPLOYEE) {
    const employee = await prisma.employee.findUnique({
      where: { userId: session.sub },
      select: { roleProfile: true }
    });

    if (employee?.roleProfile === "MANAGER") {
      redirect(`/${locale}/admin/attendance`);
    }

    redirect(`/${locale}/admin/transactions`);
  }

  redirect(`/${locale}/admin/attendance`);
}
