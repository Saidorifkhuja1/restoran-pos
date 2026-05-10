import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel, Modal } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";

type Zone = { id: string; name: string; color: string; _count: { tables: number } };
type Table = { id: string; number: number; capacity: number; shape: string; status: string; zone: { name: string } };

export function ZonesPage() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((state) => state.restaurant);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0f766e");
  const [number, setNumber] = useState(1);
  const [capacity, setCapacity] = useState(4);
  const [zoneId, setZoneId] = useState("");
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editZoneName, setEditZoneName] = useState("");
  const [editZoneColor, setEditZoneColor] = useState("#0f766e");
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [editTableNumber, setEditTableNumber] = useState(1);
  const [editTableCapacity, setEditTableCapacity] = useState(4);
  const zones = useQuery({ queryKey: ["zones"], queryFn: () => getData<Zone[]>("/admin/zones") });
  const tables = useQuery({ queryKey: ["tables", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`) });
  const createZone = useMutation({ mutationFn: () => apiClient.post("/admin/zones", { name, color }), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["zones"] }) });
  const createTable = useMutation({
    mutationFn: () => apiClient.post(`/restaurants/${restaurant?.id}/tables`, { zoneId, number, capacity, shape: "SQUARE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["zones"] }),
  });
  const updateZone = useMutation({ mutationFn: () => apiClient.put(`/admin/zones/${editingZone?.id}`, { name: editZoneName, color: editZoneColor }), onSuccess: async () => { setEditingZone(null); await queryClient.invalidateQueries({ queryKey: ["zones"] }); } });
  const deleteZone = useMutation({ mutationFn: (id: string) => apiClient.delete(`/admin/zones/${id}`), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["zones"] }) });
  const updateTable = useMutation({ mutationFn: () => apiClient.put(`/restaurants/${restaurant?.id}/tables/${editingTable?.id}`, { number: editTableNumber, capacity: editTableCapacity }), onSuccess: async () => { setEditingTable(null); await queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }); } });
  const deleteTable = useMutation({ mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurant?.id}/tables/${id}`), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }) });

  function submitZone(event: FormEvent<HTMLFormElement>) { event.preventDefault(); createZone.mutate(); }
  function submitTable(event: FormEvent<HTMLFormElement>) { event.preventDefault(); createTable.mutate(); }
  function openZone(zone: Zone) { setEditingZone(zone); setEditZoneName(zone.name); setEditZoneColor(zone.color); }
  function openTable(table: Table) { setEditingTable(table); setEditTableNumber(table.number); setEditTableCapacity(table.capacity); }

  return (
    <>
      <PageTitle title="Zonalar va stollar" subtitle="Zal, xona va stol konfiguratsiyasi" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Panel><form className="space-y-3" onSubmit={submitZone}><input className="w-full rounded-md border px-3 py-2" placeholder="Zona nomi" value={name} onChange={(e) => setName(e.target.value)} /><input className="h-10 w-full rounded-md border" type="color" value={color} onChange={(e) => setColor(e.target.value)} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Zona qo'shish</button></form></Panel>
          <Panel><form className="space-y-3" onSubmit={submitTable}><select className="w-full rounded-md border px-3 py-2" value={zoneId} onChange={(e) => setZoneId(e.target.value)}><option value="">Zona tanlang</option>{zones.data?.map((zone) => <option value={zone.id} key={zone.id}>{zone.name}</option>)}</select><input className="w-full rounded-md border px-3 py-2" type="number" value={number} onChange={(e) => setNumber(Number(e.target.value))} /><input className="w-full rounded-md border px-3 py-2" type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /><button className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Stol qo'shish</button></form></Panel>
        </div>
        <Panel>
          <div className="mb-3 font-semibold">Zonalar</div>
          {zones.data?.map((zone) => <div className="flex items-center justify-between border-b py-3" key={zone.id}><div className="flex items-center gap-3"><span className="h-4 w-4 rounded" style={{ background: zone.color }} /><span className="font-medium">{zone.name}</span></div><div className="flex items-center gap-2"><span className="text-sm text-slate-500">{zone._count.tables} stol</span><button className="rounded-md border px-2 py-1 text-xs" onClick={() => openZone(zone)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteZone.mutate(zone.id)}>Delete</button></div></div>)}
          <div className="mb-3 mt-6 font-semibold">Stollar</div>
          {tables.data?.items.map((table) => <div className="flex items-center justify-between border-b py-3" key={table.id}><div><div className="font-medium">Stol {table.number}</div><div className="text-sm text-slate-500">{table.zone.name} · {table.capacity} kishi · {table.status}</div></div><div className="flex gap-2"><button className="rounded-md border px-2 py-1 text-xs" onClick={() => openTable(table)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteTable.mutate(table.id)}>Delete</button></div></div>)}
        </Panel>
      </div>
      {editingZone ? <Modal title="Zonani tahrirlash" onClose={() => setEditingZone(null)}><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); updateZone.mutate(); }}><input className="w-full rounded-md border px-3 py-2" value={editZoneName} onChange={(event) => setEditZoneName(event.target.value)} /><input className="h-10 w-full rounded-md border" type="color" value={editZoneColor} onChange={(event) => setEditZoneColor(event.target.value)} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Saqlash</button></form></Modal> : null}
      {editingTable ? <Modal title="Stolni tahrirlash" onClose={() => setEditingTable(null)}><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); updateTable.mutate(); }}><input className="w-full rounded-md border px-3 py-2" type="number" value={editTableNumber} onChange={(event) => setEditTableNumber(Number(event.target.value))} /><input className="w-full rounded-md border px-3 py-2" type="number" value={editTableCapacity} onChange={(event) => setEditTableCapacity(Number(event.target.value))} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Saqlash</button></form></Modal> : null}
    </>
  );
}
