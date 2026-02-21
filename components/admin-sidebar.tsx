import Link from "next/link";

type Group = {
  title: string;
  items: { label: string; href: string }[];
};

export function AdminSidebar({ locale }: { locale: string }): React.ReactElement {
  const groups: Group[] = [
    {
      title: "Customers",
      items: [
        { label: "Bookings", href: `/${locale}/admin/bookings` },
        { label: "Reviews", href: `/${locale}/admin/reviews` },
        { label: "Membership Orders", href: `/${locale}/admin/membership-orders` },
        { label: "Users", href: `/${locale}/admin/users` }
      ]
    },
    {
      title: "Employees",
      items: [
        { label: "Attendance", href: `/${locale}/admin/attendance` },
        { label: "Salaries", href: `/${locale}/admin/salaries` }
      ]
    },
    {
      title: "Center",
      items: [
        { label: "Services", href: `/${locale}/admin/services` },
        { label: "Offers/Slider", href: `/${locale}/admin/offers` },
        { label: "About/Settings", href: `/${locale}/admin/about-settings` },
        { label: "Working Hours", href: `/${locale}/admin/working-hours` }
      ]
    },
    {
      title: "Accounting",
      items: [
        { label: "Transactions", href: `/${locale}/admin/transactions` },
        { label: "Invoices", href: `/${locale}/admin/invoices` },
        { label: "Suppliers", href: `/${locale}/admin/suppliers` },
        { label: "Reports", href: `/${locale}/admin/reports` }
      ]
    },
    {
      title: "System",
      items: [
        { label: "Audit Logs", href: `/${locale}/admin/audit-logs` },
        { label: "Backups", href: `/${locale}/admin/backups` }
      ]
    }
  ];

  return (
    <aside className="rounded-xl border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-700">Admin</h2>
      <div className="space-y-2">
        {groups.map((group) => (
          <details key={group.title} open className="rounded-lg border border-slate-200 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold">{group.title}</summary>
            <nav className="mt-2 grid gap-1">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-800"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        ))}
      </div>
    </aside>
  );
}
