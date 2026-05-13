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

const toneByStatus = {
  FREE: "green",
  OCCUPIED: "blue",
  RESERVED: "yellow",
  BILL_REQUESTED: "red",
} as const;

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
              className="rounded-md border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
              onClick={() => setSelectedWaiterSection(section.id)}
            >
              <div className="text-2xl font-semibold text-slate-950">{section.id === "cabins" ? t.cabins : section.id === "hall" ? t.hall : t.street}</div>
            </button>
          ))}
        </div>
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
        <PageTitle title={t.tables} subtitle={user?.role === UserRole.WAITER ? undefined : "Zal xaritasi va stol holatlari"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleTables.map((table) => (
          <Panel key={table.id}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xl font-semibold">{t.table} {table.number}</div>
                <div className="text-sm text-slate-500">{table.zone.name} · {table.capacity} {t.people}</div>
              </div>
              <Badge tone={toneByStatus[table.status]}>{table.status}</Badge>
            </div>
            <button
              className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => router.push(table.currentOrderId ? `/orders/${table.currentOrderId}` : `/order/${table.id}`)}
            >
              {t.open}
            </button>
          </Panel>
        ))}
        {visibleTables.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{t.emptySection}</div> : null}
      </div>
    </>
  );
}
