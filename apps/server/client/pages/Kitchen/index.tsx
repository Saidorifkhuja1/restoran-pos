"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { Badge, PageTitle, Panel } from "@/client/components/ui";
import { dictionary, usePreferencesStore } from "@/client/store/preferencesStore";

type Order = {
  id: string;
  orderNumber: number;
  status: string;
  sentToKitchenAt?: string;
  table: { number: number };
  items: { id: string; name: string; quantity: number; note?: string | null; status: string }[];
};

function getElapsedMinutes(dateString?: string): number {
  if (!dateString) return 0;
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 60_000);
}

function timerColor(minutes: number): "green" | "yellow" | "red" {
  if (minutes < 8) return "green";
  if (minutes < 15) return "yellow";
  return "red";
}

type Translation = (typeof dictionary)[keyof typeof dictionary];

function orderStatusLabel(status: string, t: Translation): string {
  const labels: Record<string, string> = {
    OPEN: t.statusOpen,
    IN_KITCHEN: t.statusInKitchen,
    READY: t.statusReady,
    BILL: t.statusBill,
    PAID: t.statusPaid,
    CANCELLED: t.statusCancelled,
  };
  return labels[status] || status;
}

const timerBadgeStyles: Record<ReturnType<typeof timerColor>, string> = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-300",
  yellow: "bg-amber-100 text-amber-800 border-amber-300",
  red: "bg-red-100 text-red-800 border-red-300 animate-pulse",
};

function OrderCard({
  order,
  onMarkDone,
  isMarking,
  t,
}: {
  order: Order;
  onMarkDone: (payload: { orderId: string; itemId: string }) => void;
  isMarking: boolean;
  t: Translation;
}) {
  const minutes = useMemo(() => getElapsedMinutes(order.sentToKitchenAt), [order.sentToKitchenAt]);
  const color = timerColor(minutes);

  return (
    <Panel className={color === "red" ? "ring-2 ring-red-400" : undefined}>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">#{order.orderNumber} · {t.table} {order.table.number}</div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${timerBadgeStyles[color]}`}>
            ⏱ {minutes} daq
          </span>
          <Badge tone="yellow">{orderStatusLabel(order.status, t)}</Badge>
        </div>
      </div>
      <div className="space-y-2">
        {order.items.map((item) => (
          <div className="rounded-md bg-slate-50 p-3" key={item.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{item.name} x{item.quantity}</div>
              <button
                className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                disabled={item.status === "DONE" || isMarking}
                onClick={() => onMarkDone({ orderId: order.id, itemId: item.id })}
              >
                Tayyor
              </button>
            </div>
            {item.note ? <div className="text-sm text-slate-500">{item.note}</div> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function KitchenPage() {
  const queryClient = useQueryClient();
  const language = usePreferencesStore((state) => state.settings.language);
  const t = dictionary[language];
  const orders = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: () => getData<Paginated<Order>>("/orders?status=IN_KITCHEN&limit=50"),
    refetchInterval: 30_000,
  });
  const markDone = useMutation({
    mutationFn: (payload: { orderId: string; itemId: string }) =>
      apiClient.put(`/orders/${payload.orderId}/items/${payload.itemId}/status`, { status: "DONE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    },
  });

  return (
    <>
      <PageTitle title="KDS" subtitle="Oshxona buyurtmalari" />
      <div className="grid gap-3 lg:grid-cols-3">
        {orders.data?.items.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onMarkDone={markDone.mutate}
            isMarking={markDone.isPending}
            t={t}
          />
        ))}
      </div>
    </>
  );
}
