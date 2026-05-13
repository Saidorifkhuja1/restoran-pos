"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { Modal, PageTitle, Panel } from "@/client/components/ui";

type Expense = { id: string; name: string; amount: number; note?: string | null; createdAt: string; user?: { name: string } | null };

const expenseSchema = z.object({
  name: z.string().min(2, "Nomi kerak"),
  amount: z.coerce.number().int().positive("Summa musbat bo'lishi kerak"),
  note: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Expense | null>(null);
  const createForm = useForm<ExpenseForm>({ resolver: zodResolver(expenseSchema), defaultValues: { name: "", amount: 0, note: "" } });
  const editForm = useForm<ExpenseForm>({ resolver: zodResolver(expenseSchema), defaultValues: { name: "", amount: 0, note: "" } });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => getData<Paginated<Expense>>("/admin/expenses?limit=50") });
  const createExpense = useMutation({
    mutationFn: (values: ExpenseForm) => apiClient.post("/admin/expenses", { ...values, note: values.note || undefined }),
    onSuccess: async () => {
      createForm.reset({ name: "", amount: 0, note: "" });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["expenses"] }), queryClient.invalidateQueries({ queryKey: ["admin-report"] })]);
    },
  });
  const updateExpense = useMutation({
    mutationFn: (values: ExpenseForm) => apiClient.put(`/admin/expenses/${editing?.id}`, { ...values, note: values.note || null }),
    onSuccess: async () => {
      setEditing(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["expenses"] }), queryClient.invalidateQueries({ queryKey: ["admin-report"] })]);
    },
  });
  const deleteExpense = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/expenses/${id}`),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["expenses"] }), queryClient.invalidateQueries({ queryKey: ["admin-report"] })]);
    },
  });
  useEffect(() => {
    if (editing) editForm.reset({ name: editing.name, amount: editing.amount, note: editing.note || "" });
  }, [editForm, editing]);

  return (
    <>
      <PageTitle title="Xarajatlar" subtitle="Kunlik xarajatlar hisobot daromadidan alohida hisoblanadi" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <form className="space-y-3" onSubmit={createForm.handleSubmit((values) => createExpense.mutate(values))}>
            <input aria-label="Xarajat nomi" className="w-full rounded-md border px-3 py-2" placeholder="Nomi" {...createForm.register("name")} />
            <input aria-label="Xarajat summasi" className="w-full rounded-md border px-3 py-2" type="number" min={1} {...createForm.register("amount")} />
            <textarea aria-label="Izoh" className="w-full rounded-md border px-3 py-2" placeholder="Izoh" {...createForm.register("note")} />
            <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={createExpense.isPending}>Qo'shish</button>
          </form>
        </Panel>
        <Panel>
          <div className="divide-y divide-slate-100">
            {expenses.data?.items.map((expense) => (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={expense.id}>
                <div><div className="font-medium">{expense.name}</div><div className="text-sm text-slate-500">{expense.user?.name || "Admin"} · {new Date(expense.createdAt).toLocaleString("uz-UZ")}</div></div>
                <div className="flex items-center gap-2"><div className="font-semibold">{expense.amount.toLocaleString("uz-UZ")} UZS</div><button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setEditing(expense)}>Edit</button><button className="rounded-md border border-rose-200 px-3 py-1.5 text-sm text-rose-700" onClick={() => window.confirm("Xarajat o'chirilsinmi?") && deleteExpense.mutate(expense.id)}>Delete</button></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {editing ? (
        <Modal title="Xarajatni tahrirlash" onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={editForm.handleSubmit((values) => updateExpense.mutate(values))}>
            <input className="w-full rounded-md border px-3 py-2" {...editForm.register("name")} />
            <input className="w-full rounded-md border px-3 py-2" type="number" {...editForm.register("amount")} />
            <textarea className="w-full rounded-md border px-3 py-2" {...editForm.register("note")} />
            <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={updateExpense.isPending}>Saqlash</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
