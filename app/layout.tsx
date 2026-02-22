import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDictionary, getDirection } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Mohammad Khwaileh Center",
  description: "Mohammad Khwaileh Hybrid & Electric Car Service Center Platform"
};

export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value === "ar" ? "ar" : "en";
  const dict = getDictionary(locale);

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <span className="sr-only">{dict.centerName}</span>
        {children}
      </body>
    </html>
  );
}
