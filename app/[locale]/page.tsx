import { EmployeeRoleProfile, Role } from "@prisma/client";
import Link from "next/link";
import { ServiceCard } from "@/components/services/ServiceCard";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function normalizeCarType(category: string | null): string {
  const value = category?.toUpperCase() ?? "";
  if (value.includes("HYBRID")) {
    return "HYBRID";
  }
  if (value.includes("EV") || value.includes("ELECTRIC")) {
    return "EV";
  }
  if (value.includes("FUEL")) {
    return "FUEL";
  }
  return category?.trim() || "GENERAL";
}

export default async function HomePage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const session = await getSession();
  let services: Awaited<ReturnType<typeof prisma.service.findMany>> = [];
  let servicesLoadFailed = false;
  let employeeRoleProfile: EmployeeRoleProfile | null = null;

  try {
    const [serviceRows, employeeProfile] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 6
      }),
      session?.role === Role.EMPLOYEE
        ? prisma.employee.findUnique({
            where: { userId: session.sub },
            select: { roleProfile: true }
          })
        : Promise.resolve(null)
    ]);

    services = serviceRows;
    employeeRoleProfile = employeeProfile?.roleProfile ?? null;
  } catch {
    servicesLoadFailed = true;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-8">
        <h1 className="text-3xl font-bold text-brand-900">{dict.heroTitle}</h1>
        <p className="mt-3 max-w-2xl text-slate-700">{dict.heroSubtitle}</p>
      </section>

      {session ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Quick Access</h2>
            <p className="mt-1 text-sm text-slate-600">
              {session.role === Role.EMPLOYEE
                ? "Your attendance tools are here."
                : "Open the attendance dashboard directly from here."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {session.role === Role.EMPLOYEE ? (
              <Link
                href={`/${locale}/employee/qr-scan`}
                className="rounded-2xl border border-sky-200 bg-white p-5 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Employee</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">QR Scan</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Open the camera scanner and review your recent check-in and check-out history.
                </p>
              </Link>
            ) : null}

            {(session.role === Role.ADMIN || employeeRoleProfile === EmployeeRoleProfile.MANAGER) ? (
              <Link
                href={`/${locale}/admin/attendance`}
                className="rounded-2xl border border-emerald-200 bg-white p-5 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Admin</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Attendance Dashboard</h3>
                <p className="mt-2 text-sm text-slate-600">
                  View fixed QR codes, global scan logs, and per-employee attendance details.
                </p>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{dict.servicesTitle}</h2>
        {servicesLoadFailed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {locale === "ar"
              ? "تعذر تحميل الخدمات حاليا. تحقق من إعدادات قاعدة البيانات ثم أعد المحاولة."
              : "Could not load services right now. Check database settings and try again."}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              title={locale === "ar" ? service.nameAr : service.nameEn}
              description={locale === "ar" ? service.descriptionAr : service.descriptionEn}
              duration={formatDuration(service.durationMinutes)}
              price={service.basePrice?.toString() ?? null}
              image={service.imageUrl}
              carType={normalizeCarType(service.category)}
              href={`/${locale}/bookings/new?serviceId=${service.id}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
