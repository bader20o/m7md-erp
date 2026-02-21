import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { getDictionary } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export default async function RegisterPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">{dict.authRegisterTitle}</h1>
      <RegisterForm locale={locale} />
      <p className="text-sm text-slate-600">
        {locale === "ar" ? "لديك حساب بالفعل؟" : "Already registered?"}{" "}
        <Link href={`/${locale}/login`} className="text-brand-700">
          {locale === "ar" ? "تسجيل الدخول" : "Login"}
        </Link>
      </p>
    </div>
  );
}

