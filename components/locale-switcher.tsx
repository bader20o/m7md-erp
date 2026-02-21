"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function LocaleSwitcher({ locale }: { locale: string }): React.ReactElement {
  const pathname = usePathname();
  const target = locale === "en" ? "ar" : "en";
  const nextPath = pathname.replace(/^\/(en|ar)/, `/${target}`);

  return (
    <Link
      href={nextPath}
      className="rounded-md border border-brand-700 px-3 py-1 text-sm font-medium text-brand-800 hover:bg-brand-50"
    >
      {target.toUpperCase()}
    </Link>
  );
}

