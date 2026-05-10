import { useQuery } from "@tanstack/react-query";
import { getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel } from "@/client/components/ui";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  createdAt: string;
  actorUser?: { name: string; role: string } | null;
  actorSuperAdminId?: string | null;
};

export function AuditPage() {
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => getData<Paginated<AuditLog>>("/admin/audit?limit=50"),
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageTitle title="Audit log" subtitle="Kim nima qilgani bo'yicha action history" />
      <Panel>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Vaqt</th>
                <th className="py-2 pr-4">Actor</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Entity</th>
                <th className="py-2 pr-4">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.isLoading ? <tr><td className="py-3 text-slate-500" colSpan={5}>Yuklanmoqda...</td></tr> : null}
              {audit.data?.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4">{new Date(item.createdAt).toLocaleString("uz-UZ")}</td>
                  <td className="py-3 pr-4">{item.actorUser ? `${item.actorUser.name} (${item.actorUser.role})` : item.actorSuperAdminId ? "SUPERADMIN" : "System"}</td>
                  <td className="py-3 pr-4 font-medium">{item.action}</td>
                  <td className="py-3 pr-4">{item.entity}{item.entityId ? ` · ${item.entityId.slice(0, 8)}` : ""}</td>
                  <td className="py-3 pr-4 text-slate-500">{item.ipAddress || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
