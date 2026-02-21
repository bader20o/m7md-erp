import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function AboutPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  let about: Awaited<ReturnType<typeof prisma.aboutSettings.findUnique>> = null;
  let hours: Awaited<ReturnType<typeof prisma.workingHour.findMany>> = [];
  let contentLoadFailed = false;

  try {
    [about, hours] = await Promise.all([
      prisma.aboutSettings.findUnique({ where: { id: 1 } }),
      prisma.workingHour.findMany({ orderBy: { dayOfWeek: "asc" } })
    ]);
  } catch {
    contentLoadFailed = true;
  }

  if (contentLoadFailed) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {locale === "ar"
          ? "تعذر تحميل معلومات المركز حالياً. تحقق من إعدادات قاعدة البيانات ثم أعد المحاولة."
          : "Could not load center information right now. Check database settings and try again."}
      </p>
    );
  }

  if (!about) {
    return <p className="text-sm text-slate-600">No center information available yet.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">{locale === "ar" ? about.centerNameAr : about.centerNameEn}</h1>
        <p className="mt-2 text-sm text-slate-700">
          {locale === "ar" ? about.descriptionAr : about.descriptionEn}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">{locale === "ar" ? "معلومات التواصل" : "Contact"}</h2>
        <div className="mt-2 grid gap-2 text-sm text-slate-700">
          {about.phone ? <p>Phone: {about.phone}</p> : null}
          {about.whatsapp ? <p>WhatsApp: {about.whatsapp}</p> : null}
          {about.instagramUrl ? (
            <p>
              Instagram:{" "}
              <a className="text-brand-700 underline" href={about.instagramUrl} target="_blank" rel="noreferrer">
                {about.instagramUrl}
              </a>
            </p>
          ) : null}
          {about.facebookUrl ? (
            <p>
              Facebook:{" "}
              <a className="text-brand-700 underline" href={about.facebookUrl} target="_blank" rel="noreferrer">
                {about.facebookUrl}
              </a>
            </p>
          ) : null}
          {about.xUrl ? (
            <p>
              X:{" "}
              <a className="text-brand-700 underline" href={about.xUrl} target="_blank" rel="noreferrer">
                {about.xUrl}
              </a>
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">{locale === "ar" ? "ساعات العمل" : "Working Hours"}</h2>
        <div className="mt-2 grid gap-1 text-sm text-slate-700">
          {hours.map((item) => (
            <p key={item.id}>
              Day {item.dayOfWeek}: {item.isClosed ? "Closed" : `${item.openTime} - ${item.closeTime}`}
            </p>
          ))}
        </div>
      </section>

      {about.mapEmbedUrl ? (
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-3 font-semibold">{locale === "ar" ? "الموقع" : "Location"}</h2>
          <iframe
            src={about.mapEmbedUrl}
            className="h-[300px] w-full rounded-lg border border-slate-200"
            loading="lazy"
            title="Center map"
          />
        </section>
      ) : null}
    </div>
  );
}
