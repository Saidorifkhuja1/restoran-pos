"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";

type Stats = { restaurants: number; activeRestaurants: number; orders: number; revenue: number; users: number };
type Restaurant = { id: string; name: string; type?: string | null; isActive: boolean; plan: string };

export function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const stats = useQuery({ queryKey: ["superadmin-stats"], queryFn: () => getData<Stats>("/superadmin/stats") });
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: () => getData<Paginated<Restaurant>>("/superadmin/restaurants?limit=50") });
  const createRestaurant = useMutation({
    mutationFn: () => apiClient.post("/superadmin/restaurants", { name, type, adminName, adminPhone, adminPin }),
    onSuccess: async () => {
      setName(""); setType(""); setAdminName(""); setAdminPhone(""); setAdminPin("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
        queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] }),
      ]);
    },
  });
  const changeStatus = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) => apiClient.put(`/superadmin/restaurants/${payload.id}/status`, { isActive: payload.isActive }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
  });
  const changePlan = useMutation({
    mutationFn: (payload: { id: string; plan: string }) => apiClient.put(`/superadmin/restaurants/${payload.id}/plan`, { plan: payload.plan }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createRestaurant.mutate();
  }
  async function handleLogout() {
    await apiClient.post("/auth/logout").catch(() => undefined);
    logout();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <PageTitle title="Platform" subtitle="Restoranlar va umumiy statistika" />
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={handleLogout}>Chiqish</button>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Panel><div className="text-sm text-slate-500">Restoranlar</div><div className="text-2xl font-semibold">{stats.data?.restaurants ?? 0}</div></Panel>
        <Panel><div className="text-sm text-slate-500">Aktiv</div><div className="text-2xl font-semibold">{stats.data?.activeRestaurants ?? 0}</div></Panel>
        <Panel><div className="text-sm text-slate-500">Order</div><div className="text-2xl font-semibold">{stats.data?.orders ?? 0}</div></Panel>
        <Panel><div className="text-sm text-slate-500">Daromad</div><div className="text-2xl font-semibold">{(stats.data?.revenue ?? 0).toLocaleString("uz-UZ")}</div></Panel>
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel>
        <form className="space-y-3" onSubmit={submit}>
          <div className="text-sm font-semibold">Yangi restoran</div>
          <input className="w-full rounded-md border px-3 py-2" placeholder="Restoran nomi" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="w-full rounded-md border px-3 py-2" placeholder="Turi" value={type} onChange={(event) => setType(event.target.value)} />
          <input className="w-full rounded-md border px-3 py-2" placeholder="Admin ismi" value={adminName} onChange={(event) => setAdminName(event.target.value)} />
          <input className="w-full rounded-md border px-3 py-2" placeholder="Admin telefon" value={adminPhone} onChange={(event) => setAdminPhone(event.target.value)} />
          <input className="w-full rounded-md border px-3 py-2" placeholder="Admin PIN" maxLength={4} value={adminPin} onChange={(event) => setAdminPin(event.target.value)} />
          <button className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Yaratish</button>
        </form>
      </Panel>
      <Panel>
        <div className="mb-3 text-sm font-semibold">Restoranlar</div>
        <div className="divide-y divide-slate-100">
          {restaurants.data?.items.map((restaurant) => (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={restaurant.id}>
              <div><Link className="font-medium text-teal-800 hover:underline" href={`/superadmin/restaurants/${restaurant.id}`}>{restaurant.name}</Link><div className="text-sm text-slate-500">{restaurant.type || "Restaurant"}</div></div>
              <div className="flex items-center gap-2">
                <select className="rounded-md border px-2 py-1 text-sm" value={restaurant.plan} onChange={(event) => changePlan.mutate({ id: restaurant.id, plan: event.target.value })}>
                  <option value="FREE">FREE</option><option value="BASIC">BASIC</option><option value="PRO">PRO</option><option value="ENTERPRISE">ENTERPRISE</option>
                </select>
                <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => changeStatus.mutate({ id: restaurant.id, isActive: !restaurant.isActive })}>
                  {restaurant.isActive ? "Deaktiv" : "Aktiv"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      </div>
    </main>
  );
}
