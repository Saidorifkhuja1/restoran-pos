import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/api/client";
import { Badge, PageTitle, Panel } from "@/components/ui";
import { usePusherEvent } from "@/hooks/usePusher";
import { useAuthStore } from "@/store/authStore";

type Order = {
  id: string;
  orderNumber: number;
  status: string;
  sentToKitchenAt?: string;
  table: { number: number };
  items: { id: string; name: string; quantity: number; note?: string | null; status: string }[];
};

export function KitchenPage() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((state) => state.restaurant);
  usePusherEvent(restaurant?.id ? `kitchen:${restaurant.id}` : null, "new-order", () => {
    void queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
  });
  const orders = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: () => getData<Paginated<Order>>("/orders?status=IN_KITCHEN&limit=50"),
    refetchInterval: 10_000,
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
          <Panel key={order.id}>
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">#{order.orderNumber} · Stol {order.table.number}</div>
              <Badge tone="yellow">{order.status}</Badge>
            </div>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div className="rounded-md bg-slate-50 p-3" key={item.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{item.name} x{item.quantity}</div>
                    <button className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={item.status === "DONE"} onClick={() => markDone.mutate({ orderId: order.id, itemId: item.id })}>
                      Tayyor
                    </button>
                  </div>
                  {item.note ? <div className="text-sm text-slate-500">{item.note}</div> : null}
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
