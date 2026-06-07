"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getData, Paginated } from "@/client/api/client";
import { Badge, PageTitle, Panel } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";
import { dictionary, usePreferencesStore } from "@/client/store/preferencesStore";

type Table = {
  id: string;
  number: number;
  capacity: number;
  status: "FREE" | "OCCUPIED" | "RESERVED" | "BILL_REQUESTED";
  currentOrderId?: string | null;
  zone: { id: string; name: string; color: string };
};
type ActiveOrder = {
  id: string;
  orderNumber: number;
  status: string;
  createdAt: string;
  table: { id: string; number: number; status: string; zone: { id: string; name: string } };
  waiter: { id: string; name: string };
  items: { id: string; name: string; quantity: number; price: number; status: string }[];
};

const toneByStatus = {
  FREE: "green",
  OCCUPIED: "red",
  RESERVED: "red",
  BILL_REQUESTED: "red",
} as const;

type Translation = (typeof dictionary)[keyof typeof dictionary];

function tableStatusLabel(status: Table["status"], t: Translation): string {
  const labels = {
    FREE: t.statusFree,
    OCCUPIED: t.statusOccupied,
    RESERVED: t.statusReserved,
    BILL_REQUESTED: t.statusBillRequested,
  };
  return labels[status];
}

function orderStatusLabel(status: string, t: Translation): string {
  const labels: Record<string, string> = {
    OPEN: t.statusOpen,
    IN_KITCHEN: t.statusInKitchen,
    READY: t.statusReady,
    BILL: t.statusBill,
    PAID: t.statusPaid,
    CANCELLED: t.statusCancelled,
  };
  return labels[status] || status;
}

function ActiveChecks({ orders, title, t }: { orders: ActiveOrder[]; title: string; t: Translation }) {
  if (orders.length === 0) return null;
  return (
    <div className="mt-5">
      <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {orders.map((order) => {
          const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return (
            <Panel key={order.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">#{order.orderNumber} · {t.table} {order.table.number}</div>
                <Badge tone={order.status === "READY" ? "green" : order.status === "BILL" ? "red" : "yellow"}>{orderStatusLabel(order.status, t)}</Badge>
              </div>
              <div className="mt-1 text-sm text-[var(--color-muted)]">{order.table.zone.name} · {order.waiter.name}</div>
              <div className="mt-2 text-sm font-semibold">{total.toLocaleString("uz-UZ")} UZS</div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

export function TablesPage() {
  const router = useRouter();
  const { restaurant } = useAuthStore();
  const language = usePreferencesStore((state) => state.settings.language);
  const t = dictionary[language];
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const tables = useQuery({
    queryKey: ["tables", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`),
    refetchInterval: 30_000,
  });
  const activeOrders = useQuery({
    queryKey: ["active-orders", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<ActiveOrder>>("/orders?active=true&limit=100"),
    refetchInterval: 30_000,
  });
  const zones = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; color: string; total: number; busy: number }>();
    (tables.data?.items ?? []).forEach((table) => {
      const current = grouped.get(table.zone.id) ?? { id: table.zone.id, name: table.zone.name, color: table.zone.color, total: 0, busy: 0 };
      grouped.set(table.zone.id, {
        ...current,
        total: current.total + 1,
        busy: current.busy + (table.status === "FREE" ? 0 : 1),
      });
    });
    return Array.from(grouped.values());
  }, [tables.data?.items]);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const visibleTables = useMemo(() => {
    if (!selectedZoneId) return [];
    return (tables.data?.items ?? []).filter((table) => table.zone.id === selectedZoneId);
  }, [selectedZoneId, tables.data?.items]);
  const activeOrdersForView = useMemo(() => {
    const items = activeOrders.data?.items ?? [];
    if (!selectedZoneId) return items;
    return items.filter((order) => order.table.zone.id === selectedZoneId);
  }, [activeOrders.data?.items, selectedZoneId]);

  if (!selectedZoneId) {
    return (
      <>
        <PageTitle title={t.sections} subtitle={t.selectTablePlace} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {zones.map((zone) => (
            <button
              key={zone.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-left text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface2)] active:scale-[0.99]"
              onClick={() => setSelectedZoneId(zone.id)}
            >
              <div className="mb-4 h-3 w-12 rounded-full" style={{ backgroundColor: zone.color || "#0f766e" }} />
              <div className="text-2xl font-semibold text-[var(--color-text)]">{zone.name}</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                {zone.total} stol · {zone.busy} band
              </div>
            </button>
          ))}
          {zones.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{t.emptySection}</div> : null}
        </div>
        <ActiveChecks orders={activeOrders.data?.items ?? []} title="Active cheklar" t={t} />
      </>
    );
  }

  return (
    <>
      <div className="mb-4">
        <button className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-xl leading-none text-slate-700" aria-label={t.back} onClick={() => setSelectedZoneId(null)}>
          ←
        </button>
        <PageTitle title={selectedZone?.name || t.tables} subtitle={undefined} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleTables.map((table) => {
          const isBusy = table.status !== "FREE";
          return (
            <Panel key={table.id} className={isBusy ? "border-rose-500 bg-rose-950/10 ring-1 ring-rose-500/50" : undefined}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className={isBusy ? "text-xl font-semibold text-rose-600 dark:text-rose-300" : "text-xl font-semibold"}>{t.table} {table.number}</div>
                </div>
                <Badge tone={toneByStatus[table.status]}>{tableStatusLabel(table.status, t)}</Badge>
              </div>
              <button
                className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-900/50 disabled:text-rose-100 disabled:opacity-70"
                disabled={isBusy}
                onClick={() => router.push(`/order/${table.id}`)}
              >
                {isBusy ? t.statusOccupied : t.open}
              </button>
            </Panel>
          );
        })}
        {visibleTables.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{t.emptySection}</div> : null}
      </div>
      <ActiveChecks
        orders={activeOrdersForView}
        title="Active cheklar"
        t={t}
      />
    </>
  );
}
