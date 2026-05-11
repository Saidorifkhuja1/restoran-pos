"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getData, Paginated } from "@/client/api/client";
import { Badge, PageTitle, Panel } from "@/client/components/ui";
import { usePusherEvent } from "@/client/hooks/usePusher";
import { useAuthStore } from "@/client/store/authStore";

type Table = {
  id: string;
  number: number;
  capacity: number;
  status: "FREE" | "OCCUPIED" | "RESERVED" | "BILL_REQUESTED";
  currentOrderId?: string | null;
  zone: { id: string; name: string; color: string };
};

const toneByStatus = {
  FREE: "green",
  OCCUPIED: "blue",
  RESERVED: "yellow",
  BILL_REQUESTED: "red",
} as const;

export function TablesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const restaurant = useAuthStore((state) => state.restaurant);
  usePusherEvent(restaurant?.id ? `restaurant:${restaurant.id}` : null, "table:status", () => {
    void queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] });
  });
  const tables = useQuery({
    queryKey: ["tables", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`),
  });

  return (
    <>
      <PageTitle title="Stollar" subtitle="Zal xaritasi va stol holatlari" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tables.data?.items.map((table) => (
          <Panel key={table.id}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xl font-semibold">Stol {table.number}</div>
                <div className="text-sm text-slate-500">{table.zone.name} · {table.capacity} kishi</div>
              </div>
              <Badge tone={toneByStatus[table.status]}>{table.status}</Badge>
            </div>
            <button
              className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => router.push(table.currentOrderId ? `/orders/${table.currentOrderId}` : `/order/${table.id}`)}
            >
              Ochish
            </button>
          </Panel>
        ))}
      </div>
    </>
  );
}
