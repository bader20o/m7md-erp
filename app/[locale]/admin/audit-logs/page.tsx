import { prisma } from "@/lib/prisma";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";

export default async function AdminAuditLogsPage(): Promise<React.ReactElement> {
  const logs = await prisma.auditLog.findMany({
    include: {
      actor: {
        select: {
          fullName: true,
          phone: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 300
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Logs</h1>
      <ResponsiveDataTable
        items={logs}
        getKey={(log) => log.id}
        emptyState="No audit logs yet."
        tableClassName="border border-slate-200 bg-white"
        columns={[
          {
            key: "time",
            header: "Time",
            cell: (log) => log.createdAt.toLocaleString()
          },
          {
            key: "action",
            header: "Action",
            cell: (log) => log.action
          },
          {
            key: "entity",
            header: "Entity",
            cell: (log) => (
              <>
                {log.entity}
                {log.entityId ? ` (${log.entityId})` : ""}
              </>
            )
          },
          {
            key: "actor",
            header: "Actor",
            cell: (log) => (
              <>
                {log.actor?.fullName || log.actor?.phone || "-"}
                {log.actor?.role ? ` (${log.actor.role})` : ""}
              </>
            )
          },
          {
            key: "ip",
            header: "IP",
            cell: (log) => log.ipAddress || "-"
          }
        ]}
        cardTitle={(log) => log.action}
        cardBadge={(log) => (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {log.entity}
          </span>
        )}
        cardSubtitle={(log) => log.createdAt.toLocaleString()}
        cardFields={[
          {
            key: "entity-id",
            label: "Entity",
            value: (log) => (log.entityId ? `${log.entity} (${log.entityId})` : log.entity)
          },
          {
            key: "actor",
            label: "Actor",
            value: (log) => `${log.actor?.fullName || log.actor?.phone || "-"}${log.actor?.role ? ` (${log.actor.role})` : ""}`
          },
          {
            key: "ip",
            label: "IP",
            value: (log) => log.ipAddress || "-"
          }
        ]}
      />
    </section>
  );
}
