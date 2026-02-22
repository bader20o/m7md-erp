import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

function getInitials(fullName: string | null, phone: string): string {
  if (fullName) {
    const words = fullName
      .split(" ")
      .map((word) => word.trim())
      .filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
    }
    if (words.length === 1) {
      return (words[0][0] ?? "U").toUpperCase();
    }
  }

  const digits = phone.replace(/\D/g, "");
  return digits.slice(-2).padStart(2, "0");
}

export default async function ProfilePage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      fullName: true,
      phone: true,
      role: true,
      locale: true,
      createdAt: true
    }
  });

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const displayName = user.fullName || user.phone;
  const isRtl = locale === "ar";
  const labelCellClass = isRtl ? "col-start-2 text-right" : "col-start-1 text-left";
  const valueCellClass = isRtl ? "col-start-1 text-right" : "col-start-2 text-right";
  const roleBadgeClass =
    user.role === "ADMIN"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-700";

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{dict.menuProfile}</h1>

      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-800">
            {getInitials(user.fullName, user.phone)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">{displayName}</h2>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${roleBadgeClass}`}>
              {user.role}
            </span>
          </div>
        </div>

        <div className="border-t border-slate-200" />

        <dl className="grid gap-y-1 p-5 text-sm">
          <div className="grid grid-cols-2 items-center gap-x-4 border-b border-slate-100 py-2">
            <dt className={`text-slate-500 ${labelCellClass}`}>{dict.profileNameLabel}</dt>
            <dd className={`font-medium text-slate-900 ${valueCellClass}`}>{displayName}</dd>
          </div>
          <div className="grid grid-cols-2 items-center gap-x-4 border-b border-slate-100 py-2">
            <dt className={`text-slate-500 ${labelCellClass}`}>{dict.profilePhoneLabel}</dt>
            <dd className={`font-medium text-slate-900 ${valueCellClass}`}>{user.phone}</dd>
          </div>
          <div className="grid grid-cols-2 items-center gap-x-4 border-b border-slate-100 py-2">
            <dt className={`text-slate-500 ${labelCellClass}`}>{dict.profileRoleLabel}</dt>
            <dd className={`font-medium text-slate-900 ${valueCellClass}`}>{user.role}</dd>
          </div>
          <div className="grid grid-cols-2 items-center gap-x-4 border-b border-slate-100 py-2">
            <dt className={`text-slate-500 ${labelCellClass}`}>{dict.profileLocaleLabel}</dt>
            <dd className={`font-medium text-slate-900 ${valueCellClass}`}>{user.locale.toUpperCase()}</dd>
          </div>
          <div className="grid grid-cols-2 items-center gap-x-4 py-2">
            <dt className={`text-slate-500 ${labelCellClass}`}>{dict.profileJoinedLabel}</dt>
            <dd className={`font-medium text-slate-900 ${valueCellClass}`}>{user.createdAt.toLocaleDateString()}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}
