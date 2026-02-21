import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { getDictionary } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export default async function LoginPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">{dict.authLoginTitle}</h1>
      <LoginForm locale={locale} />
      <p className="text-sm text-slate-600">
        {locale === "ar" ? "ليس لديك حساب؟" : "No account?"}{" "}
        <Link href={`/${locale}/register`} className="text-brand-700">
          {locale === "ar" ? "إنشاء حساب" : "Register"}
        </Link>
      </p>
    </div>
  );
}

