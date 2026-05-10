import { useQuery } from "@tanstack/react-query";
import { apiClient, getData } from "@/client/api/client";
import { PageTitle, Panel } from "@/client/components/ui";
import { useState } from "react";

type Report = {
  summary: { revenue: number; orders: number; paidOrders: number; averageCheck: number; discounts: number; tax: number; expenses: number };
  topItems: { name: string; quantity: number; gross: number }[];
};
type ReportJob = {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  format: "csv" | "xlsx" | "pdf";
  fileName?: string;
  error?: string;
};

export function ReportsPage() {
  const [job, setJob] = useState<ReportJob | null>(null);
  const report = useQuery({ queryKey: ["admin-report"], queryFn: () => getData<Report>("/admin/reports") });
  const jobStatus = useQuery({
    queryKey: ["report-job", job?.id],
    enabled: Boolean(job?.id && job.status !== "COMPLETED" && job.status !== "FAILED"),
    refetchInterval: 3000,
    queryFn: () => getData<ReportJob>(`/admin/reports/jobs?id=${job?.id}`),
  });
  if (jobStatus.data && jobStatus.data.status !== job?.status) {
    setJob(jobStatus.data);
  }
  const summary = report.data?.summary;
  async function exportReport(format: "csv" | "xlsx" | "pdf") {
    const response = await apiClient.get(`/admin/reports/export?format=${format}`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `restopos-report-${Date.now()}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function queueReport(format: "csv" | "xlsx" | "pdf") {
    const to = new Date();
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const response = await apiClient.post<{ data: ReportJob }>("/admin/reports/jobs", {
      from: from.toISOString(),
      to: to.toISOString(),
      format,
    });
    setJob(response.data.data);
  }
  return (
    <>
      <div className="mb-4 flex items-center justify-between"><PageTitle title="Hisobotlar" subtitle="Kunlik savdo va eksport" /><div className="flex gap-2"><button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={() => exportReport("csv")}>CSV</button><button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={() => exportReport("xlsx")}>Excel</button><button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={() => exportReport("pdf")}>PDF</button></div></div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Panel><div className="text-sm text-slate-500">Daromad</div><div className="text-2xl font-semibold">{(summary?.revenue ?? 0).toLocaleString("uz-UZ")}</div></Panel>
        <Panel><div className="text-sm text-slate-500">Order</div><div className="text-2xl font-semibold">{summary?.orders ?? 0}</div></Panel>
        <Panel><div className="text-sm text-slate-500">Chegirma</div><div className="text-2xl font-semibold">{(summary?.discounts ?? 0).toLocaleString("uz-UZ")}</div></Panel>
        <Panel><div className="text-sm text-slate-500">Xarajat</div><div className="text-2xl font-semibold">{(summary?.expenses ?? 0).toLocaleString("uz-UZ")}</div></Panel>
      </div>
      <Panel>{report.data?.topItems.map((item) => <div className="flex justify-between border-b py-3" key={item.name}><span>{item.name}</span><span>{item.quantity} dona</span></div>)}</Panel>
      <div className="mt-4">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold">Navbatdagi export</div>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => queueReport("xlsx")}>Excel job</button>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => queueReport("pdf")}>PDF job</button>
            </div>
          </div>
          {job ? (
            <div className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm">
              <span>{job.format.toUpperCase()} · {job.status}{job.error ? ` · ${job.error}` : ""}</span>
              {job.status === "COMPLETED" ? <a className="rounded-md bg-teal-700 px-3 py-2 text-white" href={`/api/admin/reports/jobs/${job.id}/download`}>Yuklash</a> : null}
            </div>
          ) : <div className="text-sm text-slate-500">Job hali yaratilmagan.</div>}
        </Panel>
      </div>
    </>
  );
}
