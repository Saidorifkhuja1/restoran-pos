"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel, Modal } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";

type Zone = { id: string; name: string; color: string; _count: { tables: number } };
type Table = { id: string; number: number; capacity: number; shape: string; status: string; zone: { name: string } };

const zoneSchema = z.object({ name: z.string().min(2), color: z.string().min(4) });
const tableSchema = z.object({ zoneId: z.string().min(1), number: z.coerce.number().int().positive(), capacity: z.coerce.number().int().positive() });
type ZoneForm = z.infer<typeof zoneSchema>;
type TableForm = z.infer<typeof tableSchema>;

export function ZonesPage() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((state) => state.restaurant);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const zoneForm = useForm<ZoneForm>({ resolver: zodResolver(zoneSchema), defaultValues: { name: "", color: "#0f766e" } });
  const tableForm = useForm<TableForm>({ resolver: zodResolver(tableSchema), defaultValues: { zoneId: "", number: 1, capacity: 4 } });
  const editZoneForm = useForm<ZoneForm>({ resolver: zodResolver(zoneSchema), defaultValues: { name: "", color: "#0f766e" } });
  const editTableForm = useForm<Omit<TableForm, "zoneId">>({ resolver: zodResolver(tableSchema.omit({ zoneId: true })), defaultValues: { number: 1, capacity: 4 } });
  const zones = useQuery({ queryKey: ["zones"], queryFn: () => getData<Zone[]>("/admin/zones") });
  const tables = useQuery({ queryKey: ["tables", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`) });
  const createZone = useMutation({ mutationFn: (values: ZoneForm) => apiClient.post("/admin/zones", values), onSuccess: async () => { zoneForm.reset({ name: "", color: "#0f766e" }); await queryClient.invalidateQueries({ queryKey: ["zones"] }); } });
  const createTable = useMutation({ mutationFn: (values: TableForm) => apiClient.post(`/restaurants/${restaurant?.id}/tables`, { ...values, shape: "SQUARE" }), onSuccess: async () => { tableForm.reset({ zoneId: "", number: 1, capacity: 4 }); await Promise.all([queryClient.invalidateQueries({ queryKey: ["zones"] }), queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] })]); } });
  const updateZone = useMutation({ mutationFn: (values: ZoneForm) => apiClient.put(`/admin/zones/${editingZone?.id}`, values), onSuccess: async () => { setEditingZone(null); await queryClient.invalidateQueries({ queryKey: ["zones"] }); } });
  const deleteZone = useMutation({ mutationFn: (id: string) => apiClient.delete(`/admin/zones/${id}`), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["zones"] }) });
  const updateTable = useMutation({ mutationFn: (values: Omit<TableForm, "zoneId">) => apiClient.put(`/restaurants/${restaurant?.id}/tables/${editingTable?.id}`, values), onSuccess: async () => { setEditingTable(null); await queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }); } });
  const deleteTable = useMutation({ mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurant?.id}/tables/${id}`), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }) });
  useEffect(() => { if (editingZone) editZoneForm.reset({ name: editingZone.name, color: editingZone.color }); }, [editZoneForm, editingZone]);
  useEffect(() => { if (editingTable) editTableForm.reset({ number: editingTable.number, capacity: editingTable.capacity }); }, [editTableForm, editingTable]);
  return (
    <>
      <PageTitle title="Zonalar va stollar" subtitle="Zal, xona va stol konfiguratsiyasi" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Panel><form className="space-y-3" onSubmit={zoneForm.handleSubmit((values) => createZone.mutate(values))}><input className="w-full rounded-md border px-3 py-2" placeholder="Zona nomi" {...zoneForm.register("name")} /><input className="h-10 w-full rounded-md border" type="color" {...zoneForm.register("color")} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Zona qo'shish</button></form></Panel>
          <Panel><form className="space-y-3" onSubmit={tableForm.handleSubmit((values) => createTable.mutate(values))}><select className="w-full rounded-md border px-3 py-2" {...tableForm.register("zoneId")}><option value="">Zona tanlang</option>{zones.data?.map((zone) => <option value={zone.id} key={zone.id}>{zone.name}</option>)}</select><input className="w-full rounded-md border px-3 py-2" type="number" {...tableForm.register("number")} /><input className="w-full rounded-md border px-3 py-2" type="number" {...tableForm.register("capacity")} /><button className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Stol qo'shish</button></form></Panel>
        </div>
        <Panel>
          <div className="mb-3 font-semibold">Zonalar</div>
          {zones.data?.map((zone) => <div className="flex items-center justify-between border-b py-3" key={zone.id}><div className="flex items-center gap-3"><span className="h-4 w-4 rounded" style={{ background: zone.color }} /><span className="font-medium">{zone.name}</span></div><div className="flex items-center gap-2"><span className="text-sm text-slate-500">{zone._count.tables} stol</span><button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditingZone(zone)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteZone.mutate(zone.id)}>Delete</button></div></div>)}
          <div className="mb-3 mt-6 font-semibold">Stollar</div>
          {tables.data?.items.map((table) => <div className="flex items-center justify-between border-b py-3" key={table.id}><div><div className="font-medium">Stol {table.number}</div><div className="text-sm text-slate-500">{table.zone.name} · {table.capacity} kishi · {table.status}</div></div><div className="flex gap-2"><button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditingTable(table)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteTable.mutate(table.id)}>Delete</button></div></div>)}
        </Panel>
      </div>
      {editingZone ? <Modal title="Zonani tahrirlash" onClose={() => setEditingZone(null)}><form className="space-y-3" onSubmit={editZoneForm.handleSubmit((values) => updateZone.mutate(values))}><input className="w-full rounded-md border px-3 py-2" {...editZoneForm.register("name")} /><input className="h-10 w-full rounded-md border" type="color" {...editZoneForm.register("color")} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Saqlash</button></form></Modal> : null}
      {editingTable ? <Modal title="Stolni tahrirlash" onClose={() => setEditingTable(null)}><form className="space-y-3" onSubmit={editTableForm.handleSubmit((values) => updateTable.mutate(values))}><input className="w-full rounded-md border px-3 py-2" type="number" {...editTableForm.register("number")} /><input className="w-full rounded-md border px-3 py-2" type="number" {...editTableForm.register("capacity")} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Saqlash</button></form></Modal> : null}
    </>
  );
}
