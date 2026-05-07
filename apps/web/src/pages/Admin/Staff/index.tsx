import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/api/client";
import { PageTitle, Panel, Badge, Modal } from "@/components/ui";

type Staff = { id: string; name: string; phone?: string | null; role: string; isActive: boolean };

export function StaffPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("WAITER");
  const [editing, setEditing] = useState<Staff | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("WAITER");
  const [editPin, setEditPin] = useState("");
  const staff = useQuery({ queryKey: ["admin-staff"], queryFn: () => getData<Paginated<Staff>>("/admin/staff?limit=100") });
  const createStaff = useMutation({
    mutationFn: () => apiClient.post("/admin/staff", { name, phone: phone || undefined, pin, role }),
    onSuccess: async () => {
      setName(""); setPhone(""); setPin("");
      await queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
  });
  const updateStaff = useMutation({
    mutationFn: () =>
      apiClient.put(`/admin/staff/${editing?.id}`, {
        name: editName,
        phone: editPhone || undefined,
        role: editRole,
        newPin: editPin || undefined,
      }),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
  });
  const deleteStaff = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/staff/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-staff"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createStaff.mutate();
  }
  function openEdit(user: Staff) {
    setEditing(user);
    setEditName(user.name);
    setEditPhone(user.phone || "");
    setEditRole(user.role);
    setEditPin("");
  }

  return (
    <>
      <PageTitle title="Xodimlar" subtitle="Manager, waiter, kitchen va cashier yaratish" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <form className="space-y-3" onSubmit={submit}>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Ism" value={name} onChange={(event) => setName(event.target.value)} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="Telefon" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="PIN" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value)} />
            <select className="w-full rounded-md border px-3 py-2" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="MANAGER">MANAGER</option><option value="WAITER">WAITER</option><option value="KITCHEN">KITCHEN</option><option value="CASHIER">CASHIER</option>
            </select>
            <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Yaratish</button>
          </form>
        </Panel>
        <Panel>
          <div className="divide-y divide-slate-100">
            {staff.data?.items.map((user) => (
              <div className="flex items-center justify-between py-3" key={user.id}>
                <div><div className="font-medium">{user.name}</div><div className="text-sm text-slate-500">{user.phone || "-"}</div></div>
                <div className="flex items-center gap-2"><Badge>{user.role}</Badge><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "active" : "off"}</Badge><button className="rounded-md border px-2 py-1 text-xs" onClick={() => openEdit(user)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteStaff.mutate(user.id)}>Delete</button></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {editing ? (
        <Modal title="Xodimni tahrirlash" onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); updateStaff.mutate(); }}>
            <input className="w-full rounded-md border px-3 py-2" value={editName} onChange={(event) => setEditName(event.target.value)} />
            <input className="w-full rounded-md border px-3 py-2" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} />
            <select className="w-full rounded-md border px-3 py-2" value={editRole} onChange={(event) => setEditRole(event.target.value)}>
              <option value="MANAGER">MANAGER</option><option value="WAITER">WAITER</option><option value="KITCHEN">KITCHEN</option><option value="CASHIER">CASHIER</option>
            </select>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Yangi PIN" maxLength={4} value={editPin} onChange={(event) => setEditPin(event.target.value)} />
            <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Saqlash</button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
