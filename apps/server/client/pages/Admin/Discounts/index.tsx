"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel, Badge, Modal } from "@/client/components/ui";

type Discount = { id: string; name: string; type: string; value: number; isActive: boolean };

export function DiscountsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("PERCENT");
  const [value, setValue] = useState(10);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("PERCENT");
  const [editValue, setEditValue] = useState(0);
  const discounts = useQuery({ queryKey: ["discounts"], queryFn: () => getData<Paginated<Discount>>("/admin/discounts?limit=100") });
  const createDiscount = useMutation({ mutationFn: () => apiClient.post("/admin/discounts", { name, type, value }), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["discounts"] }) });
  const updateDiscount = useMutation({
    mutationFn: () => apiClient.put(`/admin/discounts/${editing?.id}`, { name: editName, type: editType, value: editValue }),
    onSuccess: async () => { setEditing(null); await queryClient.invalidateQueries({ queryKey: ["discounts"] }); },
  });
  const deleteDiscount = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/discounts/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["discounts"] }),
  });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); createDiscount.mutate(); }
  function openEdit(discount: Discount) {
    setEditing(discount);
    setEditName(discount.name);
    setEditType(discount.type);
    setEditValue(discount.value);
  }
  return (
    <>
      <PageTitle title="Chegirmalar" subtitle="VIP, tug'ilgan kun va lunch chegirmalari" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel><form className="space-y-3" onSubmit={submit}><input className="w-full rounded-md border px-3 py-2" placeholder="Nomi" value={name} onChange={(e) => setName(e.target.value)} /><select className="w-full rounded-md border px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}><option value="PERCENT">PERCENT</option><option value="FIXED">FIXED</option></select><input className="w-full rounded-md border px-3 py-2" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Yaratish</button></form></Panel>
        <Panel>{discounts.data?.items.map((discount) => <div className="flex items-center justify-between border-b py-3" key={discount.id}><div><div className="font-medium">{discount.name}</div><div className="text-sm text-slate-500">{discount.type} · {discount.value}</div></div><div className="flex items-center gap-2"><Badge tone={discount.isActive ? "green" : "red"}>{discount.isActive ? "active" : "off"}</Badge><button className="rounded-md border px-2 py-1 text-xs" onClick={() => openEdit(discount)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteDiscount.mutate(discount.id)}>Delete</button></div></div>)}</Panel>
      </div>
      {editing ? (
        <Modal title="Chegirmani tahrirlash" onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); updateDiscount.mutate(); }}>
            <input className="w-full rounded-md border px-3 py-2" value={editName} onChange={(event) => setEditName(event.target.value)} />
            <select className="w-full rounded-md border px-3 py-2" value={editType} onChange={(event) => setEditType(event.target.value)}><option value="PERCENT">PERCENT</option><option value="FIXED">FIXED</option></select>
            <input className="w-full rounded-md border px-3 py-2" type="number" value={editValue} onChange={(event) => setEditValue(Number(event.target.value))} />
            <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Saqlash</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
