"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, ReceiptText, Wallet } from "lucide-react";
import { getData, Paginated } from "@/client/api/client";
import { Badge } from "@/client/components/ui";
import { dictionary, usePreferencesStore } from "@/client/store/preferencesStore";

type Period = "day" | "week" | "month" | "custom";

type Shift = {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  totalSales: number;
  totalOrders: number;
  isActive: boolean;
};

type ShiftReceipt = {
  id: string;
  receiptNumber?: string | null;
  method: string;
  totalAmount: number;
  paidAt: string;
  order: {
    orderNumber: number;
    table: { number: number };
    items: { id: string; name: string; quantity: number; price: number }[];
  };
};

type Translation = (typeof dictionary)[keyof typeof dictionary];

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getPeriodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const from = startOfDay(now);
  if (period === "week") from.setDate(from.getDate() - 6);
  if (period === "month") from.setMonth(from.getMonth() - 1);
  return { from: toDateInput(from), to: toDateInput(now) };
}

function toApiDateRange(from: string, to: string): { from?: string; to?: string } {
  return {
    ...(from ? { from: startOfDay(new Date(from)).toISOString() } : {}),
    ...(to ? { to: endOfDay(new Date(to)).toISOString() } : {}),
  };
}

function methodLabel(method: string, t: Translation): string {
  const labels: Record<string, string> = {
    CASH: "Naqd",
    CARD: "Karta",
    QR: "QR",
    MIXED: "Aralash",
    OPEN: t.statusOpen,
    IN_KITCHEN: t.statusInKitchen,
    READY: t.statusReady,
    BILL: t.statusBill,
    PAID: t.statusPaid,
    CANCELLED: t.statusCancelled,
  };
  return labels[method] || method;
}

function formatTime(dateString?: string | null): string {
  if (!dateString) return "Davom etmoqda";
  return new Date(dateString).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export function ShiftsPage() {
  const language = usePreferencesStore((state) => state.settings.language);
  const t = dictionary[language];
  const initialRange = useMemo(() => getPeriodRange("day"), []);
  const [period, setPeriod] = useState<Period>("day");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const apiRange = toApiDateRange(from, to);
  const query = new URLSearchParams({
    limit: "100",
    ...(apiRange.from ? { from: apiRange.from } : {}),
    ...(apiRange.to ? { to: apiRange.to } : {}),
  }).toString();
  const shifts = useQuery({
    queryKey: ["shifts-page", query],
    queryFn: () => getData<Paginated<Shift>>(`/shifts?${query}`),
  });
  const receipts = useQuery({
    queryKey: ["shift-page-receipts", selectedShiftId],
    enabled: Boolean(selectedShiftId),
    queryFn: () => getData<ShiftReceipt[]>(`/shifts/${selectedShiftId}/receipts`),
  });
  const selectedShift = shifts.data?.items.find((shift) => shift.id === selectedShiftId);
  const totalSales = shifts.data?.items.reduce((sum, shift) => sum + shift.totalSales, 0) ?? 0;
  const totalOrders = shifts.data?.items.reduce((sum, shift) => sum + shift.totalOrders, 0) ?? 0;
  const activeCount = shifts.data?.items.filter((shift) => shift.isActive).length ?? 0;

  function applyPeriod(nextPeriod: Period) {
    setPeriod(nextPeriod);
    if (nextPeriod === "custom") return;
    const range = getPeriodRange(nextPeriod);
    setFrom(range.from);
    setTo(range.to);
    setSelectedShiftId(null);
  }

  return (
    <div className="space-y-5 text-[var(--color-text)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">{t.shifts}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Smenalar, buyurtmalar va cheklar tarixi</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-muted)]">
          <CalendarDays size={18} strokeWidth={2.4} />
          <span>{from} - {to}</span>
        </div>
      </div>

      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px]">
          <div className="inline-flex w-full rounded-md bg-[var(--color-surface2)] p-1 sm:w-fit">
            {[
              ["day", "Kunlik"],
              ["week", "Haftalik"],
              ["month", "Oylik"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={period === value ? "min-h-10 flex-1 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-[var(--color-primary-contrast)] shadow-sm sm:flex-none" : "min-h-10 flex-1 rounded-md px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)] sm:flex-none"}
                onClick={() => applyPeriod(value as Period)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="text-sm font-medium text-[var(--color-muted)]">
            Dan
            <input className="mt-1 h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" type="date" value={from} onChange={(event) => {
              setPeriod("custom");
              setFrom(event.target.value);
              setSelectedShiftId(null);
            }} />
          </label>
          <label className="text-sm font-medium text-[var(--color-muted)]">
            Gacha
            <input className="mt-1 h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" type="date" value={to} onChange={(event) => {
              setPeriod("custom");
              setTo(event.target.value);
              setSelectedShiftId(null);
            }} />
          </label>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-[var(--color-muted)]">{t.sales}</div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-contrast)]"><Wallet size={18} strokeWidth={2.5} /></span>
          </div>
          <div className="mt-3 text-2xl font-bold">{totalSales.toLocaleString("uz-UZ")} UZS</div>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-[var(--color-muted)]">{t.orders}</div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface2)] text-[var(--color-text)]"><ReceiptText size={18} strokeWidth={2.5} /></span>
          </div>
          <div className="mt-3 text-2xl font-bold">{totalOrders}</div>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-[var(--color-muted)]">Faol smena</div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface2)] text-[var(--color-text)]"><ClipboardList size={18} strokeWidth={2.5} /></span>
          </div>
          <div className="mt-3 text-2xl font-bold">{activeCount}</div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[420px_1fr]">
        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-bold">{t.shifts}</div>
            <div className="text-sm text-[var(--color-muted)]">{shifts.data?.total ?? 0} ta</div>
          </div>
          <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
            {shifts.isLoading ? <div className="text-sm text-[var(--color-muted)]">{t.loading}</div> : null}
            {shifts.data?.items.map((shift) => (
              <button
                key={shift.id}
                className={selectedShiftId === shift.id ? "block w-full rounded-md border border-[var(--color-primary)] bg-[var(--color-surface2)] p-4 text-left shadow-sm" : "block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface2)]"}
                onClick={() => setSelectedShiftId(shift.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{new Date(shift.startedAt).toLocaleDateString("uz-UZ")}</div>
                    <div className="mt-1 text-sm text-[var(--color-muted)]">
                      Boshlanish: {formatTime(shift.startedAt)} · Tugash: {formatTime(shift.endedAt)}
                    </div>
                  </div>
                  <Badge tone={shift.isActive ? "green" : "slate"}>{shift.isActive ? t.active : t.closed}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-[var(--color-surface2)] px-3 py-2">
                    <div className="text-[var(--color-muted)]">{t.sales}</div>
                    <div className="font-semibold">{shift.totalSales.toLocaleString("uz-UZ")} UZS</div>
                  </div>
                  <div className="rounded-md bg-[var(--color-surface2)] px-3 py-2">
                    <div className="text-[var(--color-muted)]">{t.orders}</div>
                    <div className="font-semibold">{shift.totalOrders}</div>
                  </div>
                </div>
              </button>
            ))}
            {shifts.data?.items.length === 0 ? <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-muted)]">{t.noShift}</div> : null}
          </div>
        </section>

        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold">{t.receipts}</div>
              {selectedShift ? <div className="text-sm text-[var(--color-muted)]">{new Date(selectedShift.startedAt).toLocaleString("uz-UZ")}</div> : null}
            </div>
            {selectedShift ? <Badge tone={selectedShift.isActive ? "green" : "slate"}>{selectedShift.isActive ? t.active : t.closed}</Badge> : null}
          </div>
          {!selectedShiftId ? <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface2)] p-8 text-center text-sm text-[var(--color-muted)]">Smena tanlang</div> : null}
          {receipts.isLoading ? <div className="text-sm text-[var(--color-muted)]">{t.loading}</div> : null}
          <div className="space-y-2">
            {receipts.data?.map((receipt) => (
              <div key={receipt.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 font-semibold">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface2)]"><ReceiptText size={17} strokeWidth={2.4} /></span>
                    {receipt.receiptNumber || `#${receipt.order.orderNumber}`}
                  </div>
                  <div className="text-lg font-bold">{receipt.totalAmount.toLocaleString("uz-UZ")} UZS</div>
                </div>
                <div className="mt-1 text-sm text-[var(--color-muted)]">{t.table} {receipt.order.table.number} · {methodLabel(receipt.method, t)} · {new Date(receipt.paidAt).toLocaleString("uz-UZ")}</div>
                <div className="mt-3 divide-y divide-[var(--color-border)] rounded-md bg-[var(--color-surface2)] px-3 text-sm">
                  {receipt.order.items.map((item) => (
                    <div className="flex justify-between gap-3 py-2" key={item.id}>
                      <span>{item.name} x{item.quantity}</span>
                      <span>{(item.price * item.quantity).toLocaleString("uz-UZ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {selectedShiftId && receipts.data?.length === 0 ? <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-muted)]">{t.noReceipts}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
