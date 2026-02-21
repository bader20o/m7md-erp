import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDictionary, getDirection, locales } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Params = { params: Promise<{ locale: string }> };

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

  return (
    <div dir={dir} className="min-h-screen">
      <header className="border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${locale}`} className="font-semibold text-brand-800">
            {dict.appName}
          </Link>

          <nav className="flex items-center gap-3 text-sm">
            <Link href={`/${locale}/services`} className="hover:text-brand-700">
              {dict.navServices}
            </Link>
            <Link href={`/${locale}/about`} className="hover:text-brand-700">
              {dict.navAbout}
            </Link>
            <Link href={`/${locale}/bookings/new`} className="hover:text-brand-700">
              {dict.navBook}
            </Link>
            <Link href={`/${locale}/memberships`} className="hover:text-brand-700">
              {dict.navMemberships}
            </Link>
            <Link href={`/${locale}/my-bookings`} className="hover:text-brand-700">
              {dict.navMyBookings}
            </Link>
            <Link href={`/${locale}/admin/bookings`} className="hover:text-brand-700">
              {dict.navAdmin}
            </Link>
            {!session ? (
              <>
                <Link href={`/${locale}/login`} className="hover:text-brand-700">
                  {dict.navLogin}
                </Link>
                <Link href={`/${locale}/register`} className="hover:text-brand-700">
                  {dict.navRegister}
                </Link>
              </>
            ) : (
              <span className="text-xs text-slate-600">
                {session.phone} ({session.role})
              </span>
            )}
            <LocaleSwitcher locale={locale} />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
