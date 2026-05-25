"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { UserRole } from "@restopos/types";
import { getData, Paginated } from "@/client/api/client";
import { Badge, PageTitle, Panel } from "@/client/components/ui";
import { usePusherEvent } from "@/client/hooks/usePusher";
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

const waiterSections = [
  { id: "cabins", title: "Kabinetlar", aliases: ["kabinet", "vip", "xona"] },
  { id: "hall", title: "Zal", aliases: ["zal", "asosiy"] },
  { id: "street", title: "Ko'cha", aliases: ["ko'cha", "kocha", "terassa", "terrace", "outdoor"] },
] as const;

type WaiterSectionId = (typeof waiterSections)[number]["id"];

function tableBelongsToSection(table: Table, sectionId: WaiterSectionId): boolean {
  const zoneName = table.zone.name.toLowerCase();
  const section = waiterSections.find((item) => item.id === sectionId);
  if (!section) return false;
  if (sectionId === "hall") {
    return !waiterSections
      .filter((item) => item.id !== "hall")
      .some((item) => item.aliases.some((alias) => zoneName.includes(alias)));
  }
  return section.aliases.some((alias) => zoneName.includes(alias));
}

function orderBelongsToSection(order: ActiveOrder, sectionId: WaiterSectionId): boolean {
  return tableBelongsToSection({ id: order.table.id, number: order.table.number, capacity: 0, status: order.table.status as Table["status"], zone: { ...order.table.zone, color: "" } }, sectionId);
}

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

function placeLabel(sectionId?: WaiterSectionId | null): string {
  if (sectionId === "cabins") return "Kabina";
  if (sectionId === "street") return "Tapchan";
  return "Stol";
}

function sectionTitle(sectionId: WaiterSectionId | null, fallback: string): string {
  if (sectionId === "cabins") return "Kabinalar";
  if (sectionId === "street") return "Tapchanlar";
  return fallback;
}

function ActiveChecks({ orders, title, t, placeName = "Stol" }: { orders: ActiveOrder[]; title: string; t: Translation; placeName?: string }) {
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
                <div className="font-semibold">#{order.orderNumber} · {placeName} {order.table.number}</div>
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
  const queryClient = useQueryClient();
  const router = useRouter();
  const { restaurant, user } = useAuthStore();
  const language = usePreferencesStore((state) => state.settings.language);
  const t = dictionary[language];
  const [selectedWaiterSection, setSelectedWaiterSection] = useState<WaiterSectionId | null>(null);
  usePusherEvent(restaurant?.id ? `restaurant:${restaurant.id}` : null, "table:status", () => {
    void queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] });
  });
  const tables = useQuery({
    queryKey: ["tables", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`),
  });
  const activeOrders = useQuery({
    queryKey: ["active-orders", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<ActiveOrder>>("/orders?active=true&scope=restaurant&limit=100"),
    refetchInterval: 10_000,
  });
  const visibleTables = useMemo(() => {
    if (user?.role !== UserRole.WAITER || !selectedWaiterSection) return tables.data?.items ?? [];
    return (tables.data?.items ?? []).filter((table) => tableBelongsToSection(table, selectedWaiterSection));
  }, [selectedWaiterSection, tables.data?.items, user?.role]);

  if (user?.role === UserRole.WAITER && !selectedWaiterSection) {
    return (
      <>
        <PageTitle title={t.sections} subtitle={t.selectTablePlace} />
        <div className="grid gap-3 sm:grid-cols-3">
          {waiterSections.map((section) => (
            <button
              key={section.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-left text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface2)] active:scale-[0.99]"
              onClick={() => setSelectedWaiterSection(section.id)}
            >
              <div className="text-2xl font-semibold text-[var(--color-text)]">{section.id === "cabins" ? t.cabins : section.id === "hall" ? t.hall : t.street}</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                {(activeOrders.data?.items ?? []).filter((order) => orderBelongsToSection(order, section.id)).length} active chek
              </div>
            </button>
          ))}
        </div>
        <ActiveChecks orders={activeOrders.data?.items ?? []} title="Active cheklar" t={t} />
      </>
    );
  }

  return (
    <>
      <div className="mb-4">
        {user?.role === UserRole.WAITER ? (
          <button className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-xl leading-none text-slate-700" aria-label={t.back} onClick={() => setSelectedWaiterSection(null)}>
            ←
          </button>
        ) : null}
        <PageTitle title={user?.role === UserRole.WAITER ? sectionTitle(selectedWaiterSection, t.tables) : t.tables} subtitle={user?.role === UserRole.WAITER ? undefined : "Zal xaritasi va stol holatlari"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleTables.map((table) => {
          const isBusy = table.status !== "FREE";
          return (
            <Panel key={table.id} className={isBusy ? "border-rose-500 bg-rose-950/10 ring-1 ring-rose-500/50" : undefined}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className={isBusy ? "text-xl font-semibold text-rose-600 dark:text-rose-300" : "text-xl font-semibold"}>{placeLabel(selectedWaiterSection)} {table.number}</div>
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
        orders={selectedWaiterSection ? (activeOrders.data?.items ?? []).filter((order) => orderBelongsToSection(order, selectedWaiterSection)) : activeOrders.data?.items ?? []}
        title="Active cheklar"
        t={t}
        placeName={placeLabel(selectedWaiterSection)}
      />
    </>
  );
}
