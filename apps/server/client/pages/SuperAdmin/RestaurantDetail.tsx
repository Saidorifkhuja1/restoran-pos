"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData } from "@/client/api/client";
import { PageTitle, Panel } from "@/client/components/ui";

type RestaurantDetail = {
  id: string;
  name: string;
  type?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  plan: string;
  users: { id: string; name: string; phone?: string | null; role: string; isActive: boolean }[];
  _count: { tables: number; orders: number };
};

export function SuperAdminRestaurantDetail() {
  const params = useParams<{ id?: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const restaurant = useQuery({
    queryKey: ["superadmin-restaurant", id],
    enabled: Boolean(id),
    queryFn: () => getData<RestaurantDetail>(`/superadmin/restaurants/${id}`),
  });
  const deleteRestaurant = useMutation({
    mutationFn: () => apiClient.delete(`/superadmin/restaurants/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["superadmin-restaurant", id] }),
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <PageTitle title={restaurant.data?.name || "Restoran"} subtitle="Detail, adminlar, xodimlar va statistika" />
        <Link className="rounded-md border px-3 py-2 text-sm" href="/superadmin/dashboard">Orqaga</Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel>
          <div className="grid gap-3 md:grid-cols-4">
            <div><div className="text-sm text-slate-500">Plan</div><div className="font-semibold">{restaurant.data?.plan}</div></div>
            <div><div className="text-sm text-slate-500">Status</div><div className="font-semibold">{restaurant.data?.isActive ? "Aktiv" : "Deaktiv"}</div></div>
            <div><div className="text-sm text-slate-500">Stollar</div><div className="font-semibold">{restaurant.data?._count.tables ?? 0}</div></div>
            <div><div className="text-sm text-slate-500">Orderlar</div><div className="font-semibold">{restaurant.data?._count.orders ?? 0}</div></div>
          </div>
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            {restaurant.data?.type || "Restaurant"} · {restaurant.data?.address || "Manzil yo'q"} · {restaurant.data?.phone || "Telefon yo'q"}
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 font-semibold">Danger zone</div>
          <button className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60" disabled={deleteRestaurant.isPending} onClick={() => window.confirm("Restoran deaktiv qilinsinmi?") && deleteRestaurant.mutate()}>
            Deaktiv / soft delete
          </button>
        </Panel>
      </div>
      <div className="mt-4">
        <Panel>
          <div className="mb-3 font-semibold">Xodimlar va adminlar</div>
          <div className="divide-y divide-slate-100">
            {restaurant.data?.users.map((user) => (
              <div className="flex items-center justify-between py-3" key={user.id}>
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-slate-500">{user.phone || "-"}</div>
                </div>
                <div className="text-sm font-semibold">{user.role} · {user.isActive ? "Aktiv" : "O'chirilgan"}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}
