"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Boxes,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  ChartNoAxesCombined,
  Clock3,
  CreditCard,
  DatabaseBackup,
  Landmark,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Presentation,
  Receipt,
  ScanLine,
  Settings2,
  ShieldCheck,
  Truck,
  UserRound,
  UsersRound,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  ADMIN_GROUP_ORDER,
  getVisibleMenuItems,
  isAdminRole,
  type MenuGroupKey,
  type MenuIconKey,
  type MenuItemConfig,
  withLocale
} from "@/components/nav/menu";
import type { Dictionary } from "@/lib/i18n";

type ShellUser = {
  id: string;
  fullName: string | null;
  phone: string;
  role: Role;
};

type AppShellProps = {
  locale: string;
  dir: "ltr" | "rtl";
  dict: Dictionary;
  user: ShellUser | null;
  children: React.ReactNode;
};

const iconMap: Record<MenuIconKey, React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  LayoutDashboard,
  CalendarPlus,
  CalendarCheck,
  CreditCard,
  UserRound,
  CalendarRange,
  MessageSquare,
  BadgeDollarSign,
  UsersRound,
  ScanLine,
  Wallet,
  Wrench,
  Presentation,
  Settings2,
  Clock3,
  Boxes,
  Landmark,
  Receipt,
  Truck,
  ChartNoAxesCombined,
  ShieldCheck,
  DatabaseBackup
};

const groupLabelKeys: Record<MenuGroupKey, keyof Dictionary> = {
  main: "menuGroupMain",
  customers: "menuGroupCustomers",
  employees: "menuGroupEmployees",
  center: "menuGroupCenter",
  accounting: "menuGroupAccounting",
  system: "menuGroupSystem"
};

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

function itemLabel(dict: Dictionary, item: MenuItemConfig): string {
  return dict[item.labelKey as keyof Dictionary] ?? item.labelKey;
}

function isRouteActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ locale, dir, dict, user, children }: AppShellProps): React.ReactElement {
  const pathname = usePathname();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const isPublicRoute =
    pathname.startsWith(`/${locale}/login`) || pathname.startsWith(`/${locale}/register`);

  useEffect(() => {
    setDrawerOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isDrawerOpen]);

  useEffect(() => {
    async function loadChatUnread(): Promise<void> {
      try {
        const response = await fetch("/api/chat/unread-count", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as {
          data?: {
            unreadCount?: number;
          };
        };
        setChatUnreadCount(json.data?.unreadCount ?? 0);
      } catch {
        // Ignore transient sidebar badge errors.
      }
    }

    if (!user || isPublicRoute) {
      setChatUnreadCount(0);
      return;
    }

    void loadChatUnread();
    const interval = window.setInterval(() => {
      void loadChatUnread();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [user, isPublicRoute, pathname]);

  if (!user || isPublicRoute) {
    return <div className="mx-auto w-full max-w-[1400px] px-4 py-6">{children}</div>;
  }

  const profileLabel = user.fullName || user.phone;
  const initials = getInitials(user.fullName, user.phone);
  const visibleItems = getVisibleMenuItems(user.role);
  const mainItems = visibleItems.filter((item) => item.group === "main");
  const adminItemsByGroup = ADMIN_GROUP_ORDER.map((group) => ({
    group,
    items: visibleItems.filter((item) => item.group === group)
  })).filter((entry) => entry.items.length > 0);
  const showAdminGroups = isAdminRole(user.role) && adminItemsByGroup.length > 0;

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col border-slate-200 bg-white lg:border-e">
      <div className="border-b border-slate-200 px-4 py-4">
        <Link href={`/${locale}`} className="text-lg font-semibold text-brand-800">
          {dict.centerName}
        </Link>
        <p className="mt-1 text-xs text-slate-500">{dict.platformTitle}</p>
      </div>

      <div className="border-b border-slate-200 px-4 py-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            aria-expanded={isProfileMenuOpen}
            aria-controls="profile-menu"
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{profileLabel}</p>
              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                {user.role}
              </span>
            </div>
          </button>

          {isProfileMenuOpen ? (
            <div
              id="profile-menu"
              className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
            >
              <Link
                href={withLocale(locale, "/profile")}
                className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
              >
                {dict.menuProfile}
              </Link>
              <LogoutButton
                locale={locale}
                label={dict.menuLogout}
                className="mt-1 w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {mainItems.length ? (
          <section className="mb-4">
            <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{dict.menuGroupMain}</h2>
            <nav className="grid gap-1">
              {mainItems.map((item) => {
                const href = withLocale(locale, item.href);
                const active = isRouteActive(pathname, href);
                const Icon = item.icon ? iconMap[item.icon] : UserRound;

                return (
                  <Link
                    key={item.key}
                    href={href}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 ${
                      active ? "bg-brand-100 text-brand-900" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={16} aria-hidden={true} />
                    <span className="flex-1">{itemLabel(dict, item)}</span>
                    {item.key === "chat" && chatUnreadCount > 0 ? (
                      <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {chatUnreadCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </section>
        ) : null}

        {showAdminGroups
          ? adminItemsByGroup.map(({ group, items }) => (
              <section key={group} className="mb-4">
                <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {dict[groupLabelKeys[group]]}
                </h2>
                <nav className="grid gap-1">
                  {items.map((item) => {
                    const href = withLocale(locale, item.href);
                    const active = isRouteActive(pathname, href);
                    const Icon = item.icon ? iconMap[item.icon] : UserRound;

                    return (
                      <Link
                        key={item.key}
                        href={href}
                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 ${
                          active ? "bg-brand-100 text-brand-900" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <Icon size={16} aria-hidden={true} />
                        <span className="flex-1">{itemLabel(dict, item)}</span>
                        {item.key === "chat" && chatUnreadCount > 0 ? (
                          <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {chatUnreadCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
              </section>
            ))
          : null}
      </div>

      <div className="hidden border-t border-slate-200 p-3 lg:block">
        <LogoutButton
          locale={locale}
          label={dict.menuLogout}
          className="w-full rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className={`mx-auto flex min-h-screen max-w-[1400px] ${dir === "rtl" ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[280px] lg:shrink-0">{sidebarContent}</aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                aria-label={dict.menuOpenNavigation}
                aria-controls="mobile-sidebar-drawer"
                aria-expanded={isDrawerOpen}
              >
                <Menu size={18} aria-hidden={true} />
              </button>
              <Link href={`/${locale}`} className="truncate text-sm font-semibold text-brand-800">
                {dict.centerName}
              </Link>
              <LocaleSwitcher locale={locale} />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={dict.menuCloseNavigation}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside
            id="mobile-sidebar-drawer"
            role="dialog"
            aria-modal="true"
            className={`absolute inset-y-0 w-[85vw] max-w-[320px] bg-white shadow-xl ${dir === "rtl" ? "right-0" : "left-0"}`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="font-semibold text-brand-800">{dict.menuNavigation}</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                aria-label={dict.menuCloseNavigation}
              >
                <X size={18} aria-hidden={true} />
              </button>
            </div>
            <div className="h-[calc(100%-57px)]">{sidebarContent}</div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
