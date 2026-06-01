"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UserRole } from "@restopos/types";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel, Badge, Modal } from "@/client/components/ui";

type StaffRole = UserRole.MANAGER | UserRole.WAITER | UserRole.KITCHEN | UserRole.CASHIER;
type Staff = { id: string; name: string; phone?: string | null; role: StaffRole; isActive: boolean };

const staffSchema = z.object({
  name: z.string().min(2, "Ism kerak"),
  phone: z.string().optional(),
  password: z.string().min(4, "Parol kamida 4 ta belgi bo'lishi kerak"),
  role: z.enum([UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER]),
});
const editStaffSchema = staffSchema.extend({ password: z.string().optional() });

type StaffForm = z.infer<typeof staffSchema>;
type EditStaffForm = z.infer<typeof editStaffSchema>;

export function StaffPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Staff | null>(null);
  const createForm = useForm<StaffForm>({ resolver: zodResolver(staffSchema), defaultValues: { name: "", phone: "", password: "", role: UserRole.WAITER } });
  const editForm = useForm<EditStaffForm>({ resolver: zodResolver(editStaffSchema), defaultValues: { name: "", phone: "", password: "", role: UserRole.WAITER } });
  const staff = useQuery({ queryKey: ["admin-staff"], queryFn: () => getData<Paginated<Staff>>("/admin/staff?limit=100") });
  const createStaff = useMutation({
    mutationFn: (values: StaffForm) => apiClient.post("/admin/staff", { ...values, phone: values.phone || undefined }),
    onSuccess: async () => {
      createForm.reset({ name: "", phone: "", password: "", role: UserRole.WAITER });
      await queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
  });
  const updateStaff = useMutation({
    mutationFn: (values: EditStaffForm) => apiClient.put(`/admin/staff/${editing?.id}`, { name: values.name, phone: values.phone || undefined, role: values.role, newPassword: values.password || undefined }),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
  });
  const deleteStaff = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/staff/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-staff"] }),
  });
  useEffect(() => {
    if (editing) editForm.reset({ name: editing.name, phone: editing.phone || "", role: editing.role, password: "" });
  }, [editForm, editing]);

  return (
    <>
      <PageTitle title="Xodimlar" subtitle="Manager, waiter, kitchen va cashier yaratish" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <form className="space-y-3" onSubmit={createForm.handleSubmit((values) => createStaff.mutate(values))}>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Ism" {...createForm.register("name")} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="Telefon" {...createForm.register("phone")} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="Parol" type="password" {...createForm.register("password")} />
            <select className="w-full rounded-md border px-3 py-2" {...createForm.register("role")}>
              <option value={UserRole.MANAGER}>MANAGER</option><option value={UserRole.WAITER}>WAITER</option><option value={UserRole.KITCHEN}>KITCHEN</option><option value={UserRole.CASHIER}>CASHIER</option>
            </select>
            <button disabled={createStaff.isPending} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Yaratish</button>
          </form>
        </Panel>
        <Panel>
          <div className="divide-y divide-slate-100">
            {staff.data?.items.map((user) => (
              <div className="flex items-center justify-between py-3" key={user.id}>
                <div><div className="font-medium">{user.name}</div><div className="text-sm text-slate-500">{user.phone || "-"}</div></div>
                <div className="flex items-center gap-2"><Badge>{user.role}</Badge><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "active" : "off"}</Badge><button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditing(user)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteStaff.mutate(user.id)}>Delete</button></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {editing ? (
        <Modal title="Xodimni tahrirlash" onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={editForm.handleSubmit((values) => updateStaff.mutate(values))}>
            <input className="w-full rounded-md border px-3 py-2" {...editForm.register("name")} />
            <input className="w-full rounded-md border px-3 py-2" {...editForm.register("phone")} />
            <select className="w-full rounded-md border px-3 py-2" {...editForm.register("role")}>
              <option value={UserRole.MANAGER}>MANAGER</option><option value={UserRole.WAITER}>WAITER</option><option value={UserRole.KITCHEN}>KITCHEN</option><option value={UserRole.CASHIER}>CASHIER</option>
            </select>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Yangi parol" type="password" {...editForm.register("password")} />
            <button disabled={updateStaff.isPending} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Saqlash</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
