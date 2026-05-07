import { useQuery } from "@tanstack/react-query";
import { getData } from "@/api/client";
import { PageTitle, Panel } from "@/components/ui";

type Report = {
  summary: { revenue: number; orders: number; paidOrders: number; averageCheck: number; expenses: number };
};

export function AdminDashboard() {
  const report = useQuery({ queryKey: ["report-today"], queryFn: () => getData<Report>("/admin/reports") });
  const summary = report.data?.summary;

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Bugungi restoran ko'rsatkichlari" />
      <div className="grid gap-3 md:grid-cols-4">
        <Panel><div className="text-sm text-slate-500">Daromad</div><div className="text-2xl font-semibold">{(summary?.revenue ?? 0).toLocaleString("uz-UZ")}</div></Panel>
        <Panel><div className="text-sm text-slate-500">Order</div><div className="text-2xl font-semibold">{summary?.orders ?? 0}</div></Panel>
        <Panel><div className="text-sm text-slate-500">To'langan</div><div className="text-2xl font-semibold">{summary?.paidOrders ?? 0}</div></Panel>
        <Panel><div className="text-sm text-slate-500">O'rtacha chek</div><div className="text-2xl font-semibold">{(summary?.averageCheck ?? 0).toLocaleString("uz-UZ")}</div></Panel>
      </div>
    </>
  );
}
