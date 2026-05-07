import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/api/client";
import { Badge, PageTitle, Panel } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

type Reservation = {
  id: string;
  guestName: string;
  guestPhone?: string | null;
  guestCount: number;
  scheduledAt: string;
  status: string;
  table: { number: number };
};
type Table = { id: string; number: number; status: string };

export function ReservationsPage() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((state) => state.restaurant);
  const [tableId, setTableId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [scheduledAt, setScheduledAt] = useState("");
  const reservations = useQuery({
    queryKey: ["reservations"],
    queryFn: () => getData<Paginated<Reservation>>("/reservations?limit=50"),
  });
  const tables = useQuery({
    queryKey: ["tables", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`),
  });
  const createReservation = useMutation({
    mutationFn: () => apiClient.post("/reservations", { tableId, guestName, guestPhone, guestCount, scheduledAt: new Date(scheduledAt).toISOString() }),
    onSuccess: async () => {
      setGuestName(""); setGuestPhone(""); setScheduledAt("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reservations"] }),
        queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }),
      ]);
    },
  });
  const arrive = useMutation({
    mutationFn: (id: string) => apiClient.post(`/reservations/${id}/arrive`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reservations"] }),
        queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }),
      ]);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createReservation.mutate();
  }

  return (
    <>
      <PageTitle title="Bronlar" subtitle="Mijoz kelishi va stol band qilish" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <form className="space-y-3" onSubmit={submit}>
            <select className="w-full rounded-md border px-3 py-2" value={tableId} onChange={(event) => setTableId(event.target.value)}>
              <option value="">Stol tanlang</option>
              {tables.data?.items.map((table) => <option value={table.id} key={table.id}>Stol {table.number} · {table.status}</option>)}
            </select>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Mijoz ismi" value={guestName} onChange={(event) => setGuestName(event.target.value)} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="Telefon" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} />
            <input className="w-full rounded-md border px-3 py-2" type="number" min={1} value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value))} />
            <input className="w-full rounded-md border px-3 py-2" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Bron qilish</button>
          </form>
        </Panel>
        <div className="grid gap-3 lg:grid-cols-2">
          {reservations.data?.items.map((reservation) => (
            <Panel key={reservation.id}>
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{reservation.guestName}</div>
                <Badge>{reservation.status}</Badge>
              </div>
              <div className="mb-3 text-sm text-slate-500">
                Stol {reservation.table.number} · {reservation.guestCount} kishi · {new Date(reservation.scheduledAt).toLocaleString("uz-UZ")}
              </div>
              <button disabled={reservation.status === "ARRIVED"} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => arrive.mutate(reservation.id)}>
                Keldi
              </button>
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}
