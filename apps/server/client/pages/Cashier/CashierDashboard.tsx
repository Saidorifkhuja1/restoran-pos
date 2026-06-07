"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Package, Truck } from "lucide-react";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { Badge, Modal, PageTitle, Panel } from "@/client/components/ui";
import { orderDisplayStatus, orderDisplayStatusLabel, orderDisplayStatuses } from "@/client/lib/order-status";
import { useAuthStore } from "@/client/store/authStore";

type Table = {
  id: string;
  number: number;
  capacity: number;
  status: "FREE" | "OCCUPIED" | "RESERVED" | "BILL_REQUESTED";
  zone: { id: string; name: string; color?: string | null };
};
type Staff = { id: string; name: string; role: string };
type Zone = { id: string; name: string; color?: string | null; _count?: { tables: number } };
type MenuCategory = {
  id: string;
  name: string;
  emoji?: string | null;
  isActive: boolean;
  _count?: { items: number };
};
type MenuItem = {
  id: string;
  name: string;
  price: number;
  emoji?: string | null;
  isActive: boolean;
  isAvailable: boolean;
  category: { id: string; name: string; isActive?: boolean };
};
type ActiveOrder = {
  id: string;
  orderNumber: number;
  status: string;
  guestCount: number;
  note?: string | null;
  createdAt: string;
  table: { id: string; number: number; status: string; zone: { id?: string; name: string } };
  waiter: { id: string; name: string };
  items: { id: string; name: string; price: number; quantity: number; status: string; note?: string | null }[];
};
type CartItem = { menuItemId: string; name: string; price: number; quantity: number };
type Discount = { id: string; name: string; type: "PERCENT" | "FIXED"; value: number };
type Settings = { autoPrintReceipt: boolean };
type PaymentResponse = { receiptNumber?: string | null; method: "CASH" | "CARD"; totalAmount: number };
type OrderPeriodFilter = "all" | "day" | "week" | "month" | "year";

const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD"]),
  discountId: z.string().optional(),
  receivedAmount: z.coerce.number().min(0),
});
type PaymentForm = z.infer<typeof paymentSchema>;

function activeOrderTotal(order: ActiveOrder) {
  return order.items.filter((item) => item.status !== "CANCELLED").reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function orderStatusTone(status: string): "green" | "yellow" | "red" {
  const displayStatus = orderDisplayStatus(status);
  if (displayStatus === "paid" || displayStatus === "delivered") return "green";
  if (displayStatus === "cancelled") return "red";
  return "yellow";
}

function isOpenOrderStatus(status: string) {
  return status !== "PAID" && status !== "CANCELLED";
}

function updateOrderInPage(
  current: Paginated<ActiveOrder> | undefined,
  orderId: string,
  status: string
): Paginated<ActiveOrder> | undefined {
  if (!current) return current;
  return {
    ...current,
    items: current.items.map((item) => (item.id === orderId ? { ...item, status } : item)),
  };
}

function markTableFree(
  current: Paginated<Table> | undefined,
  tableId: string
): Paginated<Table> | undefined {
  if (!current) return current;
  return {
    ...current,
    items: current.items.map((table) => (table.id === tableId ? { ...table, status: "FREE" } : table)),
  };
}

function isOrderInPeriod(createdAt: string, period: OrderPeriodFilter) {
  if (period === "all") return true;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();

  if (period === "day") {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }
  if (period === "month") {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (period === "year") {
    return date.getFullYear() === now.getFullYear();
  }

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek && date <= now;
}

function ActiveChecks({ orders, title, onOpen }: { orders: ActiveOrder[]; title: string; onOpen: (order: ActiveOrder) => void }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">{title}</div>
      {orders.length === 0 ? (
        <Panel>
          <div className="text-sm text-[var(--color-muted)]">Filter bo'yicha chek topilmadi</div>
        </Panel>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {orders.map((order) => (
          <button
            key={order.id}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface2)] active:scale-[0.99]"
            onClick={() => onOpen(order)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-[var(--color-text)]">
                #{order.orderNumber} · {order.note === "Kuryer" || order.note === "Olib ketish" ? order.note : `Stol ${order.table.number}`}
              </div>
              <Badge tone={orderStatusTone(order.status)}>{orderDisplayStatusLabel(order.status)}</Badge>
            </div>
            <div className="mt-1 text-sm text-[var(--color-muted)]">{order.table.zone.name} · {order.waiter.name}</div>
            <div className="mt-2 text-sm font-semibold text-[var(--color-text)]">{activeOrderTotal(order).toLocaleString("uz-UZ")} UZS</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckFilters({
  status,
  waiterId,
  period,
  waiters,
  onStatusChange,
  onWaiterChange,
  onPeriodChange,
}: {
  status: string;
  waiterId: string;
  period: OrderPeriodFilter;
  waiters: Staff[];
  onStatusChange: (value: string) => void;
  onWaiterChange: (value: string) => void;
  onPeriodChange: (value: OrderPeriodFilter) => void;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:grid-cols-3">
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Chek statusi
        <select
          className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-sm font-semibold normal-case text-[var(--color-text)]"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="all">Barcha statuslar</option>
          {orderDisplayStatuses.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Ofitsiant
        <select
          className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-sm font-semibold normal-case text-[var(--color-text)]"
          value={waiterId}
          onChange={(event) => onWaiterChange(event.target.value)}
        >
          <option value="all">Barchasi</option>
          <option value="takeaway">Olib ketish</option>
          <option value="delivery">Kuryer</option>
          {waiters.map((waiter) => (
            <option key={waiter.id} value={waiter.id}>
              {waiter.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Vaqt
        <select
          className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-sm font-semibold normal-case text-[var(--color-text)]"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value as OrderPeriodFilter)}
        >
          <option value="all">Hammasi</option>
          <option value="day">Kun</option>
          <option value="week">Hafta</option>
          <option value="month">Oy</option>
          <option value="year">Yil</option>
        </select>
      </label>
    </div>
  );
}

function WaiterPicker({ waiters, selectedWaiterId, onSelect }: { waiters: Staff[]; selectedWaiterId: string; onSelect: (id: string) => void }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-sm font-semibold text-[var(--color-muted)]">Mas'ul ofitsiant</div>
      {waiters.length === 0 ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">Faol ofitsiant topilmadi.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {waiters.map((waiter) => {
            const selected = waiter.id === selectedWaiterId;
            return (
              <button
                key={waiter.id}
                className={`rounded-md border p-3 text-left text-sm font-semibold shadow-sm transition active:scale-[0.99] ${
                  selected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface2)]"
                }`}
                onClick={() => onSelect(waiter.id)}
              >
                {waiter.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CashierDashboard() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((s) => s.restaurant);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [quickOrderType, setQuickOrderType] = useState<"delivery" | "takeaway" | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedWaiterId, setSelectedWaiterId] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingOrder, setEditingOrder] = useState<ActiveOrder | null>(null);
  const [checkStatusFilter, setCheckStatusFilter] = useState("all");
  const [checkWaiterFilter, setCheckWaiterFilter] = useState("all");
  const [checkPeriodFilter, setCheckPeriodFilter] = useState<OrderPeriodFilter>("day");

  const tables = useQuery({
    queryKey: ["cashier-tables", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`),
    refetchInterval: 30_000,
  });
  const zoneQuery = useQuery({
    queryKey: ["cashier-zones", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Zone[]>("/admin/zones"),
  });
  const orders = useQuery({
    queryKey: ["cashier-all-orders"],
    queryFn: () => getData<Paginated<ActiveOrder>>("/orders?scope=restaurant&limit=100"),
    refetchInterval: 30_000,
  });
  const staff = useQuery({
    queryKey: ["cashier-staff"],
    queryFn: () => getData<Paginated<Staff>>("/admin/staff?limit=100"),
  });
  const menuCategories = useQuery({
    queryKey: ["cashier-menu-categories", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<MenuCategory>>(`/restaurants/${restaurant?.id}/menu/categories?limit=100`),
  });
  const menu = useQuery({
    queryKey: ["cashier-menu", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<MenuItem>>(`/restaurants/${restaurant?.id}/menu/items?limit=100`),
  });

  const waiters = useMemo(() => (staff.data?.items ?? []).filter((s) => s.role === "WAITER"), [staff.data]);
  const availableMenuItems = useMemo(
    () =>
      (menu.data?.items ?? []).filter(
        (item) => item.isActive && item.isAvailable && item.category.isActive !== false
      ),
    [menu.data?.items]
  );
  const zones = useMemo(() => {
    const tableStats = new Map<string, { total: number; busy: number }>();
    (tables.data?.items ?? []).forEach((table) => {
      const current = tableStats.get(table.zone.id) ?? { total: 0, busy: 0 };
      tableStats.set(table.zone.id, {
        total: current.total + 1,
        busy: current.busy + (table.status === "FREE" ? 0 : 1),
      });
    });
    return (zoneQuery.data ?? []).map((zone) => {
      const stats = tableStats.get(zone.id);
      return {
        id: zone.id,
        name: zone.name,
        color: zone.color,
        total: stats?.total ?? zone._count?.tables ?? 0,
        busy: stats?.busy ?? 0,
      };
    });
  }, [tables.data?.items, zoneQuery.data]);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const visibleTables = useMemo(() => {
    if (!selectedZoneId) return [];
    return (tables.data?.items ?? []).filter((table) => table.zone.id === selectedZoneId);
  }, [selectedZoneId, tables.data?.items]);
  const orderByTableId = useMemo(() => {
    const map = new Map<string, ActiveOrder>();
    (orders.data?.items ?? [])
      .filter((order) => isOpenOrderStatus(order.status))
      .forEach((order) => map.set(order.table.id, order));
    return map;
  }, [orders.data?.items]);
  const categories = useMemo(() => {
    const itemCounts = new Map<string, number>();
    availableMenuItems.forEach((item) => {
      itemCounts.set(item.category.id, (itemCounts.get(item.category.id) ?? 0) + 1);
    });
    return (menuCategories.data?.items ?? [])
      .filter((category) => category.isActive)
      .map((category) => ({
        id: category.id,
        name: category.name,
        emoji: category.emoji,
        count: itemCounts.get(category.id) ?? 0,
      }));
  }, [availableMenuItems, menuCategories.data?.items]);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const categoryItems = categoryId ? availableMenuItems.filter((item) => item.category.id === categoryId) : [];
  const activeOrdersForView = useMemo(() => {
    const active = orders.data?.items ?? [];
    if (!selectedZoneId) return active;
    return active.filter((order) => order.table.zone.id === selectedZoneId || order.table.zone.name === selectedZone?.name);
  }, [orders.data?.items, selectedZone?.name, selectedZoneId]);
  const filteredOrdersForView = useMemo(
    () =>
      activeOrdersForView.filter((order) => {
        if (checkStatusFilter !== "all" && orderDisplayStatus(order.status) !== checkStatusFilter) return false;
        if (checkWaiterFilter === "takeaway" && order.note !== "Olib ketish") return false;
        if (checkWaiterFilter === "delivery" && order.note !== "Kuryer") return false;
        if (!["all", "takeaway", "delivery"].includes(checkWaiterFilter) && order.waiter.id !== checkWaiterFilter) return false;
        return isOrderInPeriod(order.createdAt, checkPeriodFilter);
      }),
    [activeOrdersForView, checkPeriodFilter, checkStatusFilter, checkWaiterFilter]
  );

  const createOrder = useMutation({
    mutationFn: async () => {
      const items = cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }));
      try {
        await apiClient.post("/orders", {
          tableId: selectedTableId,
          guestCount: 1,
          waiterId: selectedWaiterId,
          items,
        });
      } catch (error) {
        const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
        throw new Error(message || "Chek yaratishda xato");
      }
    },
    onSuccess: async () => {
      setCart([]);
      setSelectedTableId("");
      setSelectedWaiterId("");
      setCategoryId(null);
      setSelectedTable(null);
      await queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["cashier-tables"] });
    },
  });
  const createQuickOrder = useMutation({
    mutationFn: () =>
      apiClient.post("/orders/quick", {
        type: quickOrderType,
        items: cart.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
      }),
    onSuccess: async () => {
      closeCreateOrder();
      await queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
    },
  });

  function addToCart(item: MenuItem) {
    setCart((c) => {
      const existing = c.find((ci) => ci.menuItemId === item.id);
      if (existing) return c.map((ci) => ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      return [...c, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }
  function changeQuantity(menuItemId: string, delta: number) {
    setCart((current) => current.map((item) => item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function openTable(table: Table) {
    const activeOrder = orderByTableId.get(table.id);
    if (activeOrder) {
      setEditingOrder(activeOrder);
      return;
    }
    if (table.status !== "FREE") return;
    setSelectedTable(table);
    setSelectedTableId(table.id);
    setSelectedWaiterId("");
    setCategoryId(null);
    setCart([]);
  }

  function closeCreateOrder() {
    setSelectedTable(null);
    setQuickOrderType(null);
    setSelectedTableId("");
    setSelectedWaiterId("");
    setCategoryId(null);
    setCart([]);
  }

  if (selectedTable) {
    return (
      <>
        <div className="mb-4">
          <button className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-xl leading-none text-slate-700" aria-label="Orqaga" onClick={closeCreateOrder}>
            ←
          </button>
          <PageTitle
            title="Buyurtma"
            subtitle={quickOrderType === "delivery" ? "Kuryer buyurtmasi" : quickOrderType === "takeaway" ? "Olib ketish" : `Stol ${selectedTable.number} · ${selectedTable.zone.name}`}
          />
        </div>
        <div className="grid items-start gap-3 md:grid-cols-[1fr_320px]">
          <div>
            {!categoryId ? (
              <>
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      className="min-h-[150px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left shadow-sm transition hover:border-[var(--color-primary)] hover:shadow-md active:scale-[0.99]"
                      onClick={() => setCategoryId(category.id)}
                    >
                      <div className="mb-4 text-4xl">{category.emoji || "🍽"}</div>
                      <div className="text-lg font-bold text-[var(--color-text)]">{category.name}</div>
                      <div className="mt-1 text-sm text-[var(--color-muted)]">{category.count} ta taom</div>
                    </button>
                  ))}
                </div>
                {!quickOrderType ? <WaiterPicker waiters={waiters} selectedWaiterId={selectedWaiterId} onSelect={setSelectedWaiterId} /> : null}
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-lg text-[var(--color-text)] shadow-sm"
                    aria-label="Orqaga"
                    onClick={() => setCategoryId(null)}
                  >
                    ←
                  </button>
                  <div>
                    <div className="text-lg font-bold text-[var(--color-text)]">{selectedCategory?.name}</div>
                    <div className="text-sm text-[var(--color-muted)]">{categoryItems.length} ta taom</div>
                  </div>
                </div>
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryItems.map((item) => (
                    <Panel key={item.id} className="min-h-[172px]">
                      <div className="mb-3 text-3xl">{item.emoji || "🍽"}</div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-sm text-[var(--color-muted)]">{item.price.toLocaleString("uz-UZ")} UZS</div>
                      <button className="mt-4 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium shadow-sm hover:bg-[var(--color-surface2)]" onClick={() => addToCart(item)}>Qo'shish</button>
                    </Panel>
                  ))}
                </div>
                {!quickOrderType ? <WaiterPicker waiters={waiters} selectedWaiterId={selectedWaiterId} onSelect={setSelectedWaiterId} /> : null}
              </>
            )}
          </div>
          <Panel className="md:sticky md:top-20">
            <div className="mb-3 text-sm font-semibold">Savatcha</div>
            <div className="mb-3 grid gap-2">
              <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                {quickOrderType === "delivery" ? "Kuryer" : quickOrderType === "takeaway" ? "Olib ketish" : `Stol ${selectedTable.number} · ${selectedTable.zone.name}`}
              </div>
              <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                {quickOrderType ? "Ofitsiant talab qilinmaydi" : `Ofitsiant: ${waiters.find((waiter) => waiter.id === selectedWaiterId)?.name || "tanlanmagan"}`}
              </div>
            </div>
            <div className="space-y-2">
              {cart.map((item) => (
                <div className="rounded-md border border-[var(--color-primary)] bg-[var(--color-surface2)] p-3" key={item.menuItemId}>
                  <div className="flex justify-between gap-2">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm">{(item.price * item.quantity).toLocaleString("uz-UZ")}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button className="h-8 w-8 rounded-md border border-slate-400 bg-white" onClick={() => changeQuantity(item.menuItemId, -1)}>-</button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button className="h-8 w-8 rounded-md border border-slate-400 bg-white" onClick={() => changeQuantity(item.menuItemId, 1)}>+</button>
                    <span className="ml-auto text-xs text-[var(--color-muted)]">Yangi</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="my-4 flex justify-between border-t border-slate-300 pt-3 font-semibold"><span>Jami</span><span>{cartTotal.toLocaleString("uz-UZ")} UZS</span></div>
            <button
              disabled={(!quickOrderType && (!selectedTableId || !selectedWaiterId)) || cart.length === 0 || createOrder.isPending || createQuickOrder.isPending}
              className="w-full rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-primary-contrast)] disabled:opacity-50"
              onClick={() => quickOrderType ? createQuickOrder.mutate() : createOrder.mutate()}
            >
              {createOrder.isPending || createQuickOrder.isPending ? "Yuborilmoqda..." : quickOrderType ? "Chek yaratish" : !selectedWaiterId ? "Ofitsiant tanlang" : "Oshxonaga yuborish"}
            </button>
            {!quickOrderType && !selectedWaiterId ? <div className="mt-2 text-sm text-amber-600">Chek waiter profilida ko'rinishi uchun ofitsiant tanlang.</div> : null}
            {createOrder.error ? <div className="mt-2 text-sm text-rose-600">Xato: {createOrder.error.message}</div> : null}
            {createQuickOrder.error ? <div className="mt-2 text-sm text-rose-600">Tezkor buyurtma yaratilmadi</div> : null}
          </Panel>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {selectedZoneId ? (
            <button className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-xl leading-none text-slate-700" aria-label="Orqaga" onClick={() => setSelectedZoneId(null)}>
              ←
            </button>
          ) : null}
          <PageTitle title={selectedZone?.name || "Kassa"} subtitle={selectedZone ? "Stol holatini tanlang" : "Zonalar va aktiv stollar"} />
        </div>
        {!selectedZoneId ? (
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)]"
              onClick={() => {
                setSelectedTable({ id: "__delivery__", number: 0, capacity: 1, status: "FREE", zone: { id: "", name: "Kuryer" } });
                setQuickOrderType("delivery");
              }}
            >
              <Truck size={16} /> Kuryer
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface2)]"
              onClick={() => {
                setSelectedTable({ id: "__takeaway__", number: 0, capacity: 1, status: "FREE", zone: { id: "", name: "Olib ketish" } });
                setQuickOrderType("takeaway");
              }}
            >
              <Package size={16} /> Olib ketish
            </button>
          </div>
        ) : null}
      </div>

      {!selectedZoneId ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {zones.map((zone) => (
              <button
                key={zone.id}
                className="min-h-[150px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface2)] active:scale-[0.99]"
                onClick={() => setSelectedZoneId(zone.id)}
              >
                <div className="mb-4 h-3 w-12 rounded-full" style={{ backgroundColor: zone.color || "#0f766e" }} />
                <div className="text-lg font-bold text-[var(--color-text)]">{zone.name}</div>
                <div className="mt-1 text-sm text-[var(--color-muted)]">{zone.total} stol · {zone.busy} band</div>
              </button>
            ))}
            {zones.length === 0 ? <Panel><div className="text-sm text-slate-500">Zona topilmadi</div></Panel> : null}
          </div>
          <CheckFilters
            status={checkStatusFilter}
            waiterId={checkWaiterFilter}
            period={checkPeriodFilter}
            waiters={waiters}
            onStatusChange={setCheckStatusFilter}
            onWaiterChange={setCheckWaiterFilter}
            onPeriodChange={setCheckPeriodFilter}
          />
          <ActiveChecks orders={filteredOrdersForView} title="Active cheklar" onOpen={setEditingOrder} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleTables.map((table) => {
              const activeOrder = orderByTableId.get(table.id);
              const isBusy = Boolean(activeOrder) || table.status !== "FREE";
              return (
                <button
                  key={table.id}
                  className={`rounded-md border bg-[var(--color-surface)] p-4 text-left shadow-sm transition active:scale-[0.99] ${isBusy ? "border-rose-400 bg-rose-950/10 ring-1 ring-rose-400/50" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"}`}
                  onClick={() => openTable(table)}
                >
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div className={isBusy ? "text-xl font-semibold text-rose-600 dark:text-rose-300" : "text-xl font-semibold text-[var(--color-text)]"}>Stol {table.number}</div>
                    <Badge tone={isBusy ? "red" : "green"}>{isBusy ? "Band" : "Bo'sh"}</Badge>
                  </div>
                  <div className="text-sm text-[var(--color-muted)]">{table.capacity} kishi</div>
                  {activeOrder ? (
                    <div className="mt-2 text-sm font-semibold text-[var(--color-text)]">#{activeOrder.orderNumber} · {activeOrder.waiter.name}</div>
                  ) : null}
                </button>
              );
            })}
            {visibleTables.length === 0 ? <Panel><div className="text-sm text-slate-500">Bu zonada stol yo'q</div></Panel> : null}
          </div>
          <CheckFilters
            status={checkStatusFilter}
            waiterId={checkWaiterFilter}
            period={checkPeriodFilter}
            waiters={waiters}
            onStatusChange={setCheckStatusFilter}
            onWaiterChange={setCheckWaiterFilter}
            onPeriodChange={setCheckPeriodFilter}
          />
          <ActiveChecks orders={filteredOrdersForView} title="Active cheklar" onOpen={setEditingOrder} />
        </>
      )}

      {editingOrder ? (
        <OrderEditModal order={editingOrder} menu={availableMenuItems} tables={tables.data?.items ?? []} onClose={() => setEditingOrder(null)} queryClient={queryClient} />
      ) : null}
    </>
  );
}

function OrderEditModal({ order, menu, tables, onClose, queryClient }: { order: ActiveOrder; menu: MenuItem[]; tables: Table[]; onClose: () => void; queryClient: ReturnType<typeof useQueryClient> }) {
  const restaurant = useAuthStore((state) => state.restaurant);
  const [addingItem, setAddingItem] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidReceipt, setPaidReceipt] = useState<PaymentResponse | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");
  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: "CASH", discountId: "", receivedAmount: 0 },
  });
  const method = form.watch("method");
  const discountId = form.watch("discountId") || "";
  const receivedAmount = form.watch("receivedAmount");

  const discounts = useQuery({
    queryKey: ["cashier-discounts"],
    queryFn: () => getData<Paginated<Discount>>("/admin/discounts?limit=100"),
  });
  const settings = useQuery({
    queryKey: ["cashier-settings", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Settings>(`/restaurants/${restaurant?.id}/settings`),
  });

  const addItem = useMutation({
    mutationFn: (item: { menuItemId: string; quantity: number }) => apiClient.post(`/orders/${order.id}/items`, item),
    onSuccess: async () => {
      setAddingItem(false);
      await queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiClient.put(`/orders/${order.id}/status`, { status }),
    onSuccess: (_response, status) => {
      queryClient.setQueryData<Paginated<ActiveOrder>>(["cashier-all-orders"], (current) =>
        updateOrderInPage(current, order.id, status)
      );
      if (status === "CANCELLED") {
        queryClient.setQueryData<Paginated<Table>>(["cashier-tables", restaurant?.id], (current) =>
          markTableFree(current, order.table.id)
        );
        queryClient.setQueryData<Paginated<Table>>(["tables", restaurant?.id], (current) =>
          markTableFree(current, order.table.id)
        );
      }
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["cashier-tables"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });

  const payOrder = useMutation({
    mutationFn: (values: PaymentForm) =>
      apiClient.post<{ data: PaymentResponse }>(`/orders/${order.id}/payment`, {
        method: values.method,
        discountId: values.discountId || undefined,
        receivedAmount: values.method === "CASH" ? values.receivedAmount : undefined,
        receiptPrinted: Boolean(settings.data?.autoPrintReceipt),
      }),
    onSuccess: (response) => {
      setPaidReceipt(response.data.data);
      queryClient.setQueryData<Paginated<ActiveOrder>>(["cashier-all-orders"], (current) =>
        updateOrderInPage(current, order.id, "PAID")
      );
      queryClient.setQueryData<Paginated<Table>>(["cashier-tables", restaurant?.id], (current) =>
        markTableFree(current, order.table.id)
      );
      queryClient.setQueryData<Paginated<Table>>(["tables", restaurant?.id], (current) =>
        markTableFree(current, order.table.id)
      );
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["cashier-tables"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });

  const cancelItem = useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/orders/${order.id}/items/${itemId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
    },
  });
  const transferOrder = useMutation({
    mutationFn: () => apiClient.post(`/orders/${order.id}/transfer`, { targetTableId: transferTargetId }),
    onSuccess: () => {
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["cashier-tables"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });

  const activeItems = order.items.filter((item) => item.status !== "CANCELLED");
  const total = activeItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const selectedDiscount = discounts.data?.items.find((discount) => discount.id === discountId);
  const discountAmount = selectedDiscount
    ? selectedDiscount.type === "PERCENT"
      ? Math.round((total * selectedDiscount.value) / 100)
      : Math.min(selectedDiscount.value, total)
    : 0;
  const finalTotal = Math.max(0, total - discountAmount);
  const canEditItems = !["BILL", "PAID", "CANCELLED"].includes(order.status);

  useEffect(() => {
    if (method === "CASH") form.setValue("receivedAmount", Math.max(receivedAmount, finalTotal));
  }, [finalTotal, form, method, receivedAmount]);

  function openPayment() {
    setPaymentOpen(true);
    setPaidReceipt(null);
    form.reset({ method: "CASH", discountId: "", receivedAmount: finalTotal });
  }

  return (
    <Modal title={`Chek #${order.orderNumber} tahrirlash`} onClose={onClose}>
      <div className="space-y-3">
        <div className="text-sm text-slate-500">
          {order.note === "Kuryer" || order.note === "Olib ketish" ? order.note : `Stol ${order.table.number} · ${order.table.zone.name}`} · {order.waiter.name}
        </div>
        <div className="rounded-md border p-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1 text-sm">
              <span>{item.name} x{item.quantity} <span className="text-xs text-slate-400">({item.status})</span></span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{(item.price * item.quantity).toLocaleString("uz-UZ")}</span>
                {canEditItems && item.status !== "CANCELLED" ? (
                  <button
                    className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-600 disabled:opacity-50"
                    disabled={cancelItem.isPending}
                    onClick={() => cancelItem.mutate(item.id)}
                  >
                    Bekor
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <div className="mt-1 border-t pt-1 text-right font-semibold">{total.toLocaleString("uz-UZ")} UZS</div>
        </div>

        {addingItem ? (
          <div className="max-h-40 overflow-y-auto rounded-md border p-2">
            {menu.map((item) => (
              <button key={item.id} className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-100" onClick={() => addItem.mutate({ menuItemId: item.id, quantity: 1 })}>
                <span>{item.emoji || "🍽"} {item.name}</span>
                <span className="text-xs text-slate-500">{item.price.toLocaleString("uz-UZ")}</span>
              </button>
            ))}
          </div>
        ) : (
          <button className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50" disabled={!canEditItems} onClick={() => setAddingItem(true)}>+ Taom qo'shish</button>
        )}

        <div className="flex gap-2">
          {order.status === "IN_KITCHEN" ? <button disabled={updateStatus.isPending} className="flex-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => updateStatus.mutate("READY")}>{updateStatus.isPending ? "Saqlanmoqda..." : "Tayyor"}</button> : null}
          {order.status === "READY" ? <button disabled={updateStatus.isPending} className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => updateStatus.mutate("BILL")}>{updateStatus.isPending ? "Saqlanmoqda..." : "Berildi"}</button> : null}
          {order.status === "BILL" ? <button disabled={payOrder.isPending} className="flex-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={openPayment}>To'lov</button> : null}
          {order.status !== "CANCELLED" && order.status !== "PAID" ? <button disabled={updateStatus.isPending} className="flex-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => updateStatus.mutate("CANCELLED")}>Bekor</button> : null}
        </div>
        {order.note !== "Kuryer" && order.note !== "Olib ketish" && order.status !== "PAID" && order.status !== "CANCELLED" ? (
          <div className="grid grid-cols-[1fr_auto] gap-2 rounded-md border p-3">
            <select className="min-w-0 rounded-md border px-3 py-2 text-sm" value={transferTargetId} onChange={(event) => setTransferTargetId(event.target.value)}>
              <option value="">Boshqa bo'sh stolni tanlang</option>
              {tables.filter((table) => table.status === "FREE" && table.id !== order.table.id).map((table) => (
                <option key={table.id} value={table.id}>{table.zone.name} · Stol {table.number}</option>
              ))}
            </select>
            <button type="button" disabled={!transferTargetId || transferOrder.isPending} className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50" onClick={() => transferOrder.mutate()}>
              Ko'chirish
            </button>
            {transferOrder.error ? <div className="col-span-2 text-sm text-rose-600">Stolga ko'chirib bo'lmadi</div> : null}
          </div>
        ) : null}
        {paymentOpen ? (
          <form className="space-y-3 rounded-md border p-3" onSubmit={form.handleSubmit((values) => payOrder.mutate(values))}>
            <select aria-label="To'lov usuli" className="w-full rounded-md border px-3 py-2 text-sm" {...form.register("method")}>
              <option value="CASH">Naqd</option>
              <option value="CARD">Karta</option>
            </select>
            <select aria-label="Chegirma" className="w-full rounded-md border px-3 py-2 text-sm" {...form.register("discountId")}>
              <option value="">Chegirma yo'q</option>
              {discounts.data?.items.map((discount) => <option value={discount.id} key={discount.id}>{discount.name}</option>)}
            </select>
            {method === "CASH" ? <input aria-label="Qabul qilingan summa" className="w-full rounded-md border px-3 py-2 text-sm" type="number" {...form.register("receivedAmount")} /> : null}
            <ReceiptTotals subtotal={total} discount={discountAmount} total={finalTotal} change={method === "CASH" ? Math.max(0, receivedAmount - finalTotal) : undefined} />
            {payOrder.error ? <div className="text-sm text-rose-600">To'lov yakunlanmadi</div> : null}
            {paidReceipt ? <div className="text-sm text-teal-700">Chek {paidReceipt.receiptNumber || ""} yopildi</div> : null}
            <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={payOrder.isPending}>
              {payOrder.isPending ? "Yakunlanmoqda..." : "To'lovni yakunlash"}
            </button>
          </form>
        ) : null}
      </div>
    </Modal>
  );
}

function ReceiptTotals({ subtotal, discount, total, change }: { subtotal: number; discount: number; total: number; change?: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="flex justify-between"><span>Subtotal</span><span>{subtotal.toLocaleString("uz-UZ")}</span></div>
      <div className="flex justify-between"><span>Chegirma</span><span>{discount.toLocaleString("uz-UZ")}</span></div>
      <div className="flex justify-between font-semibold"><span>Jami</span><span>{total.toLocaleString("uz-UZ")}</span></div>
      {change !== undefined ? <div className="flex justify-between"><span>Qaytim</span><span>{change.toLocaleString("uz-UZ")}</span></div> : null}
    </div>
  );
}
