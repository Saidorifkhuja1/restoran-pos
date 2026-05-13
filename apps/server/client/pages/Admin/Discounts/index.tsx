"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel, Badge, Modal } from "@/client/components/ui";

type Discount = { id: string; name: string; type: "PERCENT" | "FIXED"; value: number; isActive: boolean };

const discountSchema = z.object({
  name: z.string().min(2, "Nomi kerak"),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().int().positive("Qiymat musbat bo'lishi kerak"),
});

type DiscountForm = z.infer<typeof discountSchema>;

export function DiscountsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Discount | null>(null);
  const createForm = useForm<DiscountForm>({ resolver: zodResolver(discountSchema), defaultValues: { name: "", type: "PERCENT", value: 10 } });
  const editForm = useForm<DiscountForm>({ resolver: zodResolver(discountSchema), defaultValues: { name: "", type: "PERCENT", value: 10 } });
  const discounts = useQuery({ queryKey: ["discounts"], queryFn: () => getData<Paginated<Discount>>("/admin/discounts?limit=100") });
  const createDiscount = useMutation({
    mutationFn: (values: DiscountForm) => apiClient.post("/admin/discounts", values),
    onSuccess: async () => {
      createForm.reset({ name: "", type: "PERCENT", value: 10 });
      await queryClient.invalidateQueries({ queryKey: ["discounts"] });
    },
  });
  const updateDiscount = useMutation({
    mutationFn: (values: DiscountForm) => apiClient.put(`/admin/discounts/${editing?.id}`, values),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["discounts"] });
    },
  });
  const deleteDiscount = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/discounts/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["discounts"] }),
  });
  useEffect(() => {
    if (editing) editForm.reset({ name: editing.name, type: editing.type, value: editing.value });
  }, [editForm, editing]);
  return (
    <>
      <PageTitle title="Chegirmalar" subtitle="VIP, tug'ilgan kun va lunch chegirmalari" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <form className="space-y-3" onSubmit={createForm.handleSubmit((values) => createDiscount.mutate(values))}>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Nomi" {...createForm.register("name")} />
            <p className="text-xs text-rose-600">{createForm.formState.errors.name?.message}</p>
            <select className="w-full rounded-md border px-3 py-2" {...createForm.register("type")}><option value="PERCENT">PERCENT</option><option value="FIXED">FIXED</option></select>
            <input className="w-full rounded-md border px-3 py-2" type="number" {...createForm.register("value")} />
            <p className="text-xs text-rose-600">{createForm.formState.errors.value?.message}</p>
            <button disabled={createDiscount.isPending} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Yaratish</button>
          </form>
        </Panel>
        <Panel>{discounts.data?.items.map((discount) => <div className="flex items-center justify-between border-b py-3" key={discount.id}><div><div className="font-medium">{discount.name}</div><div className="text-sm text-slate-500">{discount.type} · {discount.value}</div></div><div className="flex items-center gap-2"><Badge tone={discount.isActive ? "green" : "red"}>{discount.isActive ? "active" : "off"}</Badge><button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditing(discount)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteDiscount.mutate(discount.id)}>Delete</button></div></div>)}</Panel>
      </div>
      {editing ? (
        <Modal title="Chegirmani tahrirlash" onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={editForm.handleSubmit((values) => updateDiscount.mutate(values))}>
            <input className="w-full rounded-md border px-3 py-2" {...editForm.register("name")} />
            <select className="w-full rounded-md border px-3 py-2" {...editForm.register("type")}><option value="PERCENT">PERCENT</option><option value="FIXED">FIXED</option></select>
            <input className="w-full rounded-md border px-3 py-2" type="number" {...editForm.register("value")} />
            <button disabled={updateDiscount.isPending} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Saqlash</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
