import { prisma } from "@/lib/prisma";

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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{log.createdAt.toLocaleString()}</td>
                <td className="px-3 py-2">{log.action}</td>
                <td className="px-3 py-2">
                  {log.entity}
                  {log.entityId ? ` (${log.entityId})` : ""}
                </td>
                <td className="px-3 py-2">
                  {log.actor?.fullName || log.actor?.phone || "-"}
                  {log.actor?.role ? ` (${log.actor.role})` : ""}
                </td>
                <td className="px-3 py-2">{log.ipAddress || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
