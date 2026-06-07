"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";
import { dictionary, usePreferencesStore } from "@/client/store/preferencesStore";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  emoji?: string | null;
  category: { id: string; name: string; emoji?: string | null };
};

type Table = {
  id: string;
  number: number;
  status: string;
  currentOrderId?: string | null;
  zone?: { name: string };
};
type OrderDetail = {
  id: string;
  orderNumber: number;
  status: string;
  guestCount: number;
  table: { id: string; number: number };
  items: { id: string; name: string; price: number; quantity: number; status: string }[];
};

type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

type OrderPageProps = {
  orderId?: string;
  tableId?: string;
};

type Translation = (typeof dictionary)[keyof typeof dictionary];

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

export function OrderPage(props: OrderPageProps = {}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ orderId?: string; tableId?: string }>();
  const searchParams = useSearchParams();
  const orderId = props.orderId || params.orderId;
  const restaurant = useAuthStore((state) => state.restaurant);
  const language = usePreferencesStore((state) => state.settings.language);
  const t = dictionary[language];
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tableId, setTableId] = useState(props.tableId || params.tableId || searchParams.get("tableId") || "");
  const guestCount = 1;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transferTargetId, setTransferTargetId] = useState("");
  useEffect(() => {
    router.prefetch("/tables");
  }, [router]);
  const menu = useQuery({
    queryKey: ["menu-items", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<MenuItem>>(`/restaurants/${restaurant?.id}/menu/items?limit=100`),
  });
  const tables = useQuery({
    queryKey: ["tables", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Paginated<Table>>(`/restaurants/${restaurant?.id}/tables?limit=100`),
  });
  const existingOrder = useQuery({
    queryKey: ["order", orderId],
    enabled: Boolean(orderId),
    queryFn: () => getData<OrderDetail>(`/orders/${orderId}`),
  });
  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; emoji?: string | null; count: number }>();
    menu.data?.items.forEach((item) => {
      const existing = seen.get(item.category.id);
      if (existing) {
        seen.set(item.category.id, { ...existing, count: existing.count + 1 });
        return;
      }
      seen.set(item.category.id, { id: item.category.id, name: item.category.name, emoji: item.category.emoji, count: 1 });
    });
    return Array.from(seen.values());
  }, [menu.data?.items]);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const items = categoryId ? menu.data?.items.filter((item) => item.category.id === categoryId) : [];
  const orderItems = existingOrder.data?.items ?? [];
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = orderTotal + cartTotal;
  const sendOrder = useMutation({
    mutationFn: async () => {
      const items = cart.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity }));
      if (orderId) {
        await Promise.all(items.map((item) => apiClient.post(`/orders/${orderId}/items`, item)));
        return null;
      }
      const response = await apiClient.post<{ success: boolean; data: { id: string } }>("/orders", {
        tableId,
        guestCount,
        items,
      });
      return response.data.data.id;
    },
    onSuccess: (createdOrderId) => {
      setCart([]);
      if (createdOrderId) {
        queryClient.setQueryData<Paginated<Table>>(["tables", restaurant?.id], (current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((table) =>
              table.id === tableId ? { ...table, status: "OCCUPIED", currentOrderId: createdOrderId } : table
            ),
          };
        });
      }
      router.replace("/tables");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }),
        queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["active-orders", restaurant?.id] }),
        queryClient.invalidateQueries({ queryKey: ["order", orderId] }),
      ]);
    },
    onError: (error) => {
      console.error("[Order Error]", error);
      alert(error instanceof Error ? error.message : "Buyurtma yaratishda xato");
    },
  });
  const transferOrder = useMutation({
    mutationFn: () => apiClient.post(`/orders/${orderId}/transfer`, { targetTableId: transferTargetId }),
    onSuccess: async () => {
      setTransferTargetId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["order", orderId] }),
        queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }),
        queryClient.invalidateQueries({ queryKey: ["active-orders", restaurant?.id] }),
      ]);
    },
  });
  function addToCart(item: MenuItem) {
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.menuItemId === item.id);
      if (existing) {
        return current.map((cartItem) => cartItem.menuItemId === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem);
      }
      return [...current, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }
  function changeQuantity(menuItemId: string, delta: number) {
    setCart((current) => current.map((item) => item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  }

  return (
    <>
      <PageTitle title={t.order} subtitle={t.menuAndCart} />
      {existingOrder.data ? (
        <div className="mb-4 space-y-3 rounded-md border border-slate-300 bg-white p-3 text-sm shadow-sm">
          <div>Order #{existingOrder.data.orderNumber} · {t.table} {existingOrder.data.table.number} · {orderStatusLabel(existingOrder.data.status, t)}</div>
          {!["PAID", "CANCELLED"].includes(existingOrder.data.status) ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <select className="rounded-md border px-3 py-2" value={transferTargetId} onChange={(event) => setTransferTargetId(event.target.value)}>
                <option value="">Boshqa bo'sh stolni tanlang</option>
                {tables.data?.items.filter((table) => table.status === "FREE" && table.id !== existingOrder.data?.table.id).map((table) => (
                  <option key={table.id} value={table.id}>{table.zone?.name ? `${table.zone.name} · ` : ""}Stol {table.number}</option>
                ))}
              </select>
              <button type="button" disabled={!transferTargetId || transferOrder.isPending} className="rounded-md border border-blue-300 px-3 py-2 font-semibold text-blue-700 disabled:opacity-50" onClick={() => transferOrder.mutate()}>Ko'chirish</button>
              {transferOrder.error ? <div className="text-rose-600 sm:col-span-2">Stolga ko'chirib bo'lmadi</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="grid items-start gap-3 md:grid-cols-[1fr_320px]">
        <div>
          {!categoryId ? (
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
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3">
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-lg text-[var(--color-text)] shadow-sm"
                  aria-label={t.back}
                  onClick={() => setCategoryId(null)}
                >
                  ←
                </button>
                <div>
                  <div className="text-lg font-bold text-[var(--color-text)]">{selectedCategory?.emoji} {selectedCategory?.name}</div>
                  <div className="text-sm text-[var(--color-muted)]">{items?.length ?? 0} ta taom</div>
                </div>
              </div>
              <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items?.map((item) => (
                  <Panel key={item.id} className="min-h-[172px]">
                    <div className="mb-3 text-3xl">{item.emoji || "🍽"}</div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-[var(--color-muted)]">{item.price.toLocaleString("uz-UZ")} UZS</div>
                    <button className="mt-4 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium shadow-sm hover:bg-[var(--color-surface2)] disabled:opacity-50" disabled={!orderId && !tableId} onClick={() => addToCart(item)}>{t.add}</button>
                  </Panel>
                ))}
              </div>
            </>
          )}
        </div>
        <Panel className="md:sticky md:top-20">
          <div className="mb-3 text-sm font-semibold">{t.cart}</div>
          <div className="mb-3 grid gap-2">
            <select className="rounded-md border px-3 py-2 text-sm" value={orderId ? existingOrder.data?.table.id || "" : tableId} onChange={(event) => setTableId(event.target.value)} disabled={Boolean(orderId)}>
              <option value="">{t.selectTable}</option>
              {tables.data?.items.map((table) => (
                <option key={table.id} value={table.id}>{t.table} {table.number} · {table.status}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {orderItems.map((item) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={item.id}>
                <div className="flex justify-between gap-2">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm">{(item.price * item.quantity).toLocaleString("uz-UZ")}</div>
                </div>
                <div className="mt-2 text-sm text-slate-500">x{item.quantity} · {orderStatusLabel(item.status, t)}</div>
              </div>
            ))}
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
          <div className="my-4 flex justify-between border-t border-slate-300 pt-3 font-semibold"><span>{t.total}</span><span>{total.toLocaleString("uz-UZ")} UZS</span></div>
          <button disabled={(!orderId && !tableId) || cart.length === 0 || sendOrder.isPending} className="w-full rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-primary-contrast)] disabled:opacity-50" onClick={() => sendOrder.mutate()}>
            {sendOrder.isPending ? t.sending : t.sendKitchen}
          </button>
        </Panel>
      </div>
    </>
  );
}
