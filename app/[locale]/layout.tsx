import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import { getDictionary, getDirection, locales } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return {
    title: dict.centerName,
    description: dict.platformTitle
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}): Promise<React.ReactElement> {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  const session = await getSession();
  const dict = getDictionary(locale);
  const dir = getDirection(locale);

  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.sub },
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true
        }
      })
    : null;

  const activeUser = user && user.isActive ? user : null;

  return (
    <AppShell locale={locale} dir={dir} dict={dict} user={activeUser}>
      {children}
    </AppShell>
  );
}
