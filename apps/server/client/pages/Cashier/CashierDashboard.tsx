"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { Badge, Modal, PageTitle, Panel } from "@/client/components/ui";
import { usePusherEvent } from "@/client/hooks/usePusher";
import { useAuthStore } from "@/client/store/authStore";

type Table = {
  id: string;
  number: number;
  capacity: number;
  status: "FREE" | "OCCUPIED" | "RESERVED" | "BILL_REQUESTED";
  zone: { id: string; name: string; color?: string | null };
};
type Staff = { id: string; name: string; role: string };
type MenuItem = {
  id: string;
  name: string;
  price: number;
  emoji?: string | null;
  category: { id: string; name: string };
};
type ActiveOrder = {
  id: string;
  orderNumber: number;
  status: string;
  guestCount: number;
  createdAt: string;
  table: { id: string; number: number; status: string; zone: { id?: string; name: string } };
  waiter: { id: string; name: string };
  items: { id: string; name: string; price: number; quantity: number; status: string; note?: string | null }[];
};
type CartItem = { menuItemId: string; name: string; price: number; quantity: number };
type Discount = { id: string; name: string; type: "PERCENT" | "FIXED"; value: number };
type Settings = { autoPrintReceipt: boolean };
type PaymentResponse = { receiptNumber?: string | null; method: "CASH" | "CARD" | "QR" | "MIXED"; totalAmount: number };

const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "QR", "MIXED"]),
  discountId: z.string().optional(),
  receivedAmount: z.coerce.number().min(0),
  cashAmount: z.coerce.number().min(0),
  cardAmount: z.coerce.number().min(0),
});
type PaymentForm = z.infer<typeof paymentSchema>;

export function CashierDashboard() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((s) => s.restaurant);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedWaiterId, setSelectedWaiterId] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingOrder, setEditingOrder] = useState<ActiveOrder | null>(null);

  usePusherEvent(restaurant?.id ? `restaurant:${restaurant.id}` : null, "order:created", () => {
    void queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["cashier-tables"] });
  });
  usePusherEvent(restaurant?.id ? `restaurant:${restaurant.id}` : null, "order:updated", () => {
    void queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
  });
  usePusherEvent(restaurant?.id ? `restaurant:${restaurant.id}` : null, "table:status", () => {
    void queryClient.invalidateQueries({ queryKey: ["cashier-tables"] });
  });

  const tables = useQuery({
    queryKey: ["cashier-tables", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`),
  });
  const orders = useQuery({
    queryKey: ["cashier-all-orders"],
    queryFn: () => getData<Paginated<ActiveOrder>>("/orders?active=true&scope=restaurant&limit=100"),
    refetchInterval: 10_000,
  });
  const staff = useQuery({
    queryKey: ["cashier-staff"],
    queryFn: () => getData<Paginated<Staff>>("/admin/staff?limit=100"),
  });
  const menu = useQuery({
    queryKey: ["cashier-menu", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<MenuItem>>(`/restaurants/${restaurant?.id}/menu/items?limit=100`),
  });

  const waiters = useMemo(() => (staff.data?.items ?? []).filter((s) => s.role === "WAITER"), [staff.data]);
  const zones = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color?: string | null; total: number; busy: number }>();
    (tables.data?.items ?? []).forEach((table) => {
      const current = seen.get(table.zone.id) ?? { id: table.zone.id, name: table.zone.name, color: table.zone.color, total: 0, busy: 0 };
      seen.set(table.zone.id, {
        ...current,
        total: current.total + 1,
        busy: current.busy + (table.status === "FREE" ? 0 : 1),
      });
    });
    return Array.from(seen.values());
  }, [tables.data?.items]);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const visibleTables = useMemo(() => {
    if (!selectedZoneId) return [];
    return (tables.data?.items ?? []).filter((table) => table.zone.id === selectedZoneId);
  }, [selectedZoneId, tables.data?.items]);
  const orderByTableId = useMemo(() => {
    const map = new Map<string, ActiveOrder>();
    (orders.data?.items ?? []).forEach((order) => map.set(order.table.id, order));
    return map;
  }, [orders.data?.items]);
  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number }>();
    (menu.data?.items ?? []).forEach((item) => {
      const existing = seen.get(item.category.id);
      seen.set(item.category.id, { id: item.category.id, name: item.category.name, count: (existing?.count ?? 0) + 1 });
    });
    return Array.from(seen.values());
  }, [menu.data?.items]);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const categoryItems = categoryId ? (menu.data?.items ?? []).filter((item) => item.category.id === categoryId) : [];

  const createOrder = useMutation({
    mutationFn: async () => {
      const items = cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }));
      await apiClient.post("/orders", {
        tableId: selectedTableId,
        guestCount: 1,
        waiterId: selectedWaiterId,
        items,
      });
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

  function addToCart(item: MenuItem) {
    setCart((c) => {
      const existing = c.find((ci) => ci.menuItemId === item.id);
      if (existing) return c.map((ci) => ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      return [...c, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }
  function removeFromCart(menuItemId: string) {
    setCart((c) => c.map((ci) => ci.menuItemId === menuItemId ? { ...ci, quantity: ci.quantity - 1 } : ci).filter((ci) => ci.quantity > 0));
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
    setSelectedTableId("");
    setSelectedWaiterId("");
    setCategoryId(null);
    setCart([]);
  }

  return (
    <>
      <div className="mb-4">
        {selectedZoneId ? (
          <button className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-xl leading-none text-slate-700" aria-label="Orqaga" onClick={() => setSelectedZoneId(null)}>
            ←
          </button>
        ) : null}
        <PageTitle title={selectedZone?.name || "Kassa"} subtitle={selectedZone ? "Stol holatini tanlang" : "Zonalar va aktiv stollar"} />
      </div>

      {!selectedZoneId ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {zones.map((zone) => (
            <button
              key={zone.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface2)] active:scale-[0.99]"
              onClick={() => setSelectedZoneId(zone.id)}
            >
              <div className="mb-3 h-3 w-12 rounded-full" style={{ backgroundColor: zone.color || "#0f766e" }} />
              <div className="text-xl font-bold text-[var(--color-text)]">{zone.name}</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">{zone.total} stol · {zone.busy} band</div>
            </button>
          ))}
          {zones.length === 0 ? <Panel><div className="text-sm text-slate-500">Zona topilmadi</div></Panel> : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleTables.map((table) => {
            const activeOrder = orderByTableId.get(table.id);
            const isBusy = Boolean(activeOrder) || table.status !== "FREE";
            return (
              <button
                key={table.id}
                className={`rounded-md border bg-[var(--color-surface)] p-4 text-left shadow-sm transition active:scale-[0.99] ${isBusy ? "border-rose-400 ring-1 ring-rose-400/50" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"}`}
                onClick={() => openTable(table)}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xl font-bold text-[var(--color-text)]">Stol {table.number}</div>
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
      )}

      {selectedTable ? (
        <Modal title={`Stol ${selectedTable.number} uchun chek`} onClose={closeCreateOrder}>
          <div className="space-y-3">
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={selectedWaiterId} onChange={(e) => setSelectedWaiterId(e.target.value)}>
              <option value="">Ofitsiant tanlang</option>
              {waiters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {waiters.length === 0 ? <div className="text-sm text-rose-600">Faol ofitsiant topilmadi. Chek yaratish uchun avval ofitsiant qo'shing.</div> : null}

            {!categoryId ? (
              <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                {categories.map((category) => (
                  <button key={category.id} className="rounded-md border p-3 text-left text-sm hover:bg-slate-100" onClick={() => setCategoryId(category.id)}>
                    <div className="font-semibold">{category.name}</div>
                    <div className="text-xs text-slate-500">{category.count} ta taom</div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-lg" aria-label="Orqaga" onClick={() => setCategoryId(null)}>←</button>
                  <div className="text-sm font-semibold">{selectedCategory?.name}</div>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-md border p-2">
                  {categoryItems.map((item) => (
                    <button key={item.id} className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-100" onClick={() => addToCart(item)}>
                      <span>{item.emoji || "🍽"} {item.name}</span>
                      <span className="text-xs text-slate-500">{item.price.toLocaleString("uz-UZ")}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cart.length > 0 ? (
              <div className="rounded-md border p-2">
                <div className="mb-1 text-xs font-semibold text-slate-500">Savatcha</div>
                {cart.map((item) => (
                  <div key={item.menuItemId} className="flex items-center justify-between py-1 text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{(item.price * item.quantity).toLocaleString("uz-UZ")}</span>
                      <button className="text-rose-500 text-xs" onClick={() => removeFromCart(item.menuItemId)}>−</button>
                    </div>
                  </div>
                ))}
                <div className="mt-1 border-t pt-1 text-right font-semibold">{cartTotal.toLocaleString("uz-UZ")} UZS</div>
              </div>
            ) : null}

            <button
              className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!selectedTableId || !selectedWaiterId || cart.length === 0 || createOrder.isPending}
              onClick={() => createOrder.mutate()}
            >
              {createOrder.isPending ? "Yaratilmoqda..." : "Chek yaratish"}
            </button>
            {createOrder.error ? <div className="text-sm text-rose-600">Xato: {createOrder.error.message}</div> : null}
          </div>
        </Modal>
      ) : null}

      {editingOrder ? (
        <OrderEditModal order={editingOrder} menu={menu.data?.items ?? []} onClose={() => setEditingOrder(null)} queryClient={queryClient} />
      ) : null}
    </>
  );
}

function OrderEditModal({ order, menu, onClose, queryClient }: { order: ActiveOrder; menu: MenuItem[]; onClose: () => void; queryClient: ReturnType<typeof useQueryClient> }) {
  const restaurant = useAuthStore((state) => state.restaurant);
  const [addingItem, setAddingItem] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidReceipt, setPaidReceipt] = useState<PaymentResponse | null>(null);
  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: "CASH", discountId: "", receivedAmount: 0, cashAmount: 0, cardAmount: 0 },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["cashier-tables"] });
      onClose();
    },
  });

  const payOrder = useMutation({
    mutationFn: (values: PaymentForm) =>
      apiClient.post<{ data: PaymentResponse }>(`/orders/${order.id}/payment`, {
        method: values.method,
        discountId: values.discountId || undefined,
        receivedAmount: values.method === "CASH" ? values.receivedAmount : undefined,
        cashAmount: values.method === "MIXED" ? values.cashAmount : 0,
        cardAmount: values.method === "MIXED" ? values.cardAmount : 0,
        receiptPrinted: Boolean(settings.data?.autoPrintReceipt),
      }),
    onSuccess: async (response) => {
      setPaidReceipt(response.data.data);
      await queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["cashier-tables"] });
      onClose();
    },
  });

  const cancelItem = useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/orders/${order.id}/items/${itemId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cashier-all-orders"] });
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
  const taxAmount = Math.round((total - discountAmount) * ((restaurant?.taxPercent || 12) / 100));
  const finalTotal = Math.max(0, total - discountAmount + taxAmount);
  const canEditItems = !["BILL", "PAID", "CANCELLED"].includes(order.status);

  useEffect(() => {
    if (method === "CASH") form.setValue("receivedAmount", Math.max(receivedAmount, finalTotal));
  }, [finalTotal, form, method, receivedAmount]);

  function openPayment() {
    setPaymentOpen(true);
    setPaidReceipt(null);
    form.reset({ method: "CASH", discountId: "", receivedAmount: finalTotal, cashAmount: 0, cardAmount: 0 });
  }

  return (
    <Modal title={`Chek #${order.orderNumber} tahrirlash`} onClose={onClose}>
      <div className="space-y-3">
        <div className="text-sm text-slate-500">Stol {order.table.number} · {order.table.zone.name} · {order.waiter.name}</div>
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
          {order.status === "IN_KITCHEN" ? <button className="flex-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => updateStatus.mutate("READY")}>Tayyor</button> : null}
          {order.status === "READY" ? <button className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => updateStatus.mutate("BILL")}>Hisob</button> : null}
          {order.status === "BILL" ? <button className="flex-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white" onClick={openPayment}>To'lov</button> : null}
          {order.status !== "CANCELLED" && order.status !== "PAID" ? <button className="flex-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => updateStatus.mutate("CANCELLED")}>Bekor</button> : null}
        </div>
        {paymentOpen ? (
          <form className="space-y-3 rounded-md border p-3" onSubmit={form.handleSubmit((values) => payOrder.mutate(values))}>
            <select aria-label="To'lov usuli" className="w-full rounded-md border px-3 py-2 text-sm" {...form.register("method")}>
              <option value="CASH">Naqd</option>
              <option value="CARD">Karta</option>
              <option value="QR">QR</option>
              <option value="MIXED">Aralash</option>
            </select>
            <select aria-label="Chegirma" className="w-full rounded-md border px-3 py-2 text-sm" {...form.register("discountId")}>
              <option value="">Chegirma yo'q</option>
              {discounts.data?.items.map((discount) => <option value={discount.id} key={discount.id}>{discount.name}</option>)}
            </select>
            {method === "CASH" ? <input aria-label="Qabul qilingan summa" className="w-full rounded-md border px-3 py-2 text-sm" type="number" {...form.register("receivedAmount")} /> : null}
            {method === "MIXED" ? (
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Naqd summa" className="rounded-md border px-3 py-2 text-sm" type="number" placeholder="Naqd" {...form.register("cashAmount")} />
                <input aria-label="Karta summa" className="rounded-md border px-3 py-2 text-sm" type="number" placeholder="Karta" {...form.register("cardAmount")} />
              </div>
            ) : null}
            <ReceiptTotals subtotal={total} discount={discountAmount} tax={taxAmount} total={finalTotal} change={method === "CASH" ? Math.max(0, receivedAmount - finalTotal) : undefined} />
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

function ReceiptTotals({ subtotal, discount, tax, total, change }: { subtotal: number; discount: number; tax: number; total: number; change?: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="flex justify-between"><span>Subtotal</span><span>{subtotal.toLocaleString("uz-UZ")}</span></div>
      <div className="flex justify-between"><span>Chegirma</span><span>{discount.toLocaleString("uz-UZ")}</span></div>
      <div className="flex justify-between"><span>QQS</span><span>{tax.toLocaleString("uz-UZ")}</span></div>
      <div className="flex justify-between font-semibold"><span>Jami</span><span>{total.toLocaleString("uz-UZ")}</span></div>
      {change !== undefined ? <div className="flex justify-between"><span>Qaytim</span><span>{change.toLocaleString("uz-UZ")}</span></div> : null}
    </div>
  );
}
