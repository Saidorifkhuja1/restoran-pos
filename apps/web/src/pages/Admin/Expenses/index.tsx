import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/api/client";
import { Modal, PageTitle, Panel } from "@/components/ui";

type Expense = {
  id: string;
  name: string;
  amount: number;
  note?: string | null;
  createdAt: string;
  user?: { name: string } | null;
};

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<Expense | null>(null);
  const expenses = useQuery({
    queryKey: ["expenses"],
    queryFn: () => getData<Paginated<Expense>>("/admin/expenses?limit=50"),
  });
  const createExpense = useMutation({
    mutationFn: () => apiClient.post("/admin/expenses", { name, amount, note: note || undefined }),
    onSuccess: async () => {
      setName("");
      setAmount(0);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-report"] });
    },
  });
  const updateExpense = useMutation({
    mutationFn: (expense: Expense) => apiClient.put(`/admin/expenses/${expense.id}`, {
      name: expense.name,
      amount: expense.amount,
      note: expense.note || null,
    }),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-report"] });
    },
  });
  const deleteExpense = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/expenses/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-report"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createExpense.mutate();
  }

  return (
    <>
      <PageTitle title="Xarajatlar" subtitle="Kunlik xarajatlar hisobot daromadidan alohida hisoblanadi" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <form className="space-y-3" onSubmit={submit}>
            <input aria-label="Xarajat nomi" className="w-full rounded-md border px-3 py-2" placeholder="Nomi" value={name} onChange={(event) => setName(event.target.value)} required />
            <input aria-label="Xarajat summasi" className="w-full rounded-md border px-3 py-2" type="number" min={1} value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))} required />
            <textarea aria-label="Izoh" className="w-full rounded-md border px-3 py-2" placeholder="Izoh" value={note} onChange={(event) => setNote(event.target.value)} />
            <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={createExpense.isPending}>
              {createExpense.isPending ? "Saqlanmoqda..." : "Qo'shish"}
            </button>
            {createExpense.error ? <div className="text-sm text-rose-600">Xarajat saqlanmadi</div> : null}
          </form>
        </Panel>
        <Panel>
          <div className="divide-y divide-slate-100">
            {expenses.isLoading ? <div className="py-3 text-sm text-slate-500">Yuklanmoqda...</div> : null}
            {expenses.data?.items.map((expense) => (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={expense.id}>
                <div>
                  <div className="font-medium">{expense.name}</div>
                  <div className="text-sm text-slate-500">{expense.user?.name || "Admin"} · {new Date(expense.createdAt).toLocaleString("uz-UZ")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{expense.amount.toLocaleString("uz-UZ")} UZS</div>
                  <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setEditing(expense)}>Edit</button>
                  <button className="rounded-md border border-rose-200 px-3 py-1.5 text-sm text-rose-700" onClick={() => window.confirm("Xarajat o'chirilsinmi?") && deleteExpense.mutate(expense.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {editing ? (
        <Modal title="Xarajatni tahrirlash" onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); updateExpense.mutate(editing); }}>
            <input className="w-full rounded-md border px-3 py-2" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            <input className="w-full rounded-md border px-3 py-2" type="number" value={editing.amount} onChange={(event) => setEditing({ ...editing, amount: Number(event.target.value) })} />
            <textarea className="w-full rounded-md border px-3 py-2" value={editing.note || ""} onChange={(event) => setEditing({ ...editing, note: event.target.value })} />
            <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={updateExpense.isPending}>Saqlash</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
