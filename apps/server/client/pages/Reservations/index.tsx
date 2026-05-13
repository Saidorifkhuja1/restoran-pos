"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { Badge, PageTitle, Panel } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";

type Reservation = { id: string; guestName: string; guestPhone?: string | null; guestCount: number; scheduledAt: string; status: string; table: { number: number } };
type Table = { id: string; number: number; status: string };

const reservationSchema = z.object({
  tableId: z.string().min(1, "Stol tanlang"),
  guestName: z.string().min(2, "Mijoz ismi kerak"),
  guestPhone: z.string().optional(),
  guestCount: z.coerce.number().int().positive(),
  scheduledAt: z.string().min(1, "Vaqt kerak"),
});
type ReservationForm = z.infer<typeof reservationSchema>;

export function ReservationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const restaurant = useAuthStore((state) => state.restaurant);
  const form = useForm<ReservationForm>({ resolver: zodResolver(reservationSchema), defaultValues: { tableId: "", guestName: "", guestPhone: "", guestCount: 2, scheduledAt: "" } });
  const reservations = useQuery({ queryKey: ["reservations"], queryFn: () => getData<Paginated<Reservation>>("/reservations?limit=50") });
  const tables = useQuery({ queryKey: ["tables", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`) });
  const createReservation = useMutation({
    mutationFn: (values: ReservationForm) => apiClient.post("/reservations", { ...values, guestPhone: values.guestPhone || undefined, scheduledAt: new Date(values.scheduledAt).toISOString() }),
    onSuccess: async () => {
      form.reset({ tableId: "", guestName: "", guestPhone: "", guestCount: 2, scheduledAt: "" });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["reservations"] }), queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] })]);
    },
  });
  const arrive = useMutation({
    mutationFn: (id: string) => apiClient.post<{ data: { id: string } }>(`/reservations/${id}/arrive`),
    onSuccess: async (response) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["reservations"] }), queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] })]);
      router.push(`/orders/${response.data.data.id}`);
    },
  });

  return (
    <>
      <PageTitle title="Bronlar" subtitle="Mijoz kelishi va stol band qilish" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => createReservation.mutate(values))}>
            <select className="w-full rounded-md border px-3 py-2" {...form.register("tableId")}>
              <option value="">Stol tanlang</option>
              {tables.data?.items.map((table) => <option value={table.id} key={table.id}>Stol {table.number} · {table.status}</option>)}
            </select>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Mijoz ismi" {...form.register("guestName")} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="Telefon" {...form.register("guestPhone")} />
            <input className="w-full rounded-md border px-3 py-2" type="number" min={1} {...form.register("guestCount")} />
            <input className="w-full rounded-md border px-3 py-2" type="datetime-local" {...form.register("scheduledAt")} />
            <button disabled={createReservation.isPending} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Bron qilish</button>
          </form>
        </Panel>
        <div className="grid gap-3 lg:grid-cols-2">
          {reservations.data?.items.map((reservation) => (
            <Panel key={reservation.id}>
              <div className="mb-2 flex items-center justify-between"><div className="font-semibold">{reservation.guestName}</div><Badge>{reservation.status}</Badge></div>
              <div className="mb-3 text-sm text-slate-500">Stol {reservation.table.number} · {reservation.guestCount} kishi · {new Date(reservation.scheduledAt).toLocaleString("uz-UZ")}</div>
              <button disabled={reservation.status === "ARRIVED"} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => arrive.mutate(reservation.id)}>Keldi</button>
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}
