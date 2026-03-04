import "./globals.css";
import type { Metadata } from "next";
import { Readex_Pro, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { getDictionary, getDirection } from "@/lib/i18n";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap"
});

const readexPro = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-readex-pro",
  display: "swap"
});

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
      <body className={`${spaceGrotesk.variable} ${readexPro.variable}`}>
        <span className="sr-only">{dict.centerName}</span>
        {children}
      </body>
    </html>
  );
}
