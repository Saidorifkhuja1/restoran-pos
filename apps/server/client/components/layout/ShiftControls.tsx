"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData } from "@/client/api/client";

type Shift = {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  totalSales: number;
  totalOrders: number;
  isActive: boolean;
};

export function ShiftControls() {
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["current-shift"],
    queryFn: () => getData<Shift | null>("/shifts/current"),
    refetchInterval: 30_000,
  });
  const start = useMutation({
    mutationFn: () => apiClient.post("/shifts/start"),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["current-shift"] }),
  });
  const end = useMutation({
    mutationFn: () => apiClient.post("/shifts/end"),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["current-shift"] }),
  });

  if (current.isLoading) return <div className="hidden text-xs text-slate-500 sm:block">Smena...</div>;

  return current.data ? (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden text-slate-600 sm:inline">Smena: {new Date(current.data.startedAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</span>
      <button className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:opacity-60" disabled={end.isPending} onClick={() => window.confirm("Smena yopilsinmi?") && end.mutate()}>
        Yopish
      </button>
    </div>
  ) : (
    <button className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-contrast)] shadow-sm transition-all active:scale-95 disabled:opacity-60" disabled={start.isPending} onClick={() => start.mutate()}>
      Smena boshlash
    </button>
  );
}
