import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/api/client";
import { PageTitle, Panel } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  emoji?: string | null;
  category: { id: string; name: string };
};

type Table = {
  id: string;
  number: number;
  status: string;
};

type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

export function OrderPage() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((state) => state.restaurant);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [tableId, setTableId] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
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
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    menu.data?.items.forEach((item) => seen.set(item.category.id, item.category.name));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [menu.data?.items]);
  const items = categoryId === "all" ? menu.data?.items : menu.data?.items.filter((item) => item.category.id === categoryId);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const createOrder = useMutation({
    mutationFn: () =>
      apiClient.post("/orders", {
        tableId,
        guestCount,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          note: item.note,
        })),
      }),
    onSuccess: async () => {
      setCart([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.id] }),
        queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] }),
      ]);
    },
  });
  function addToCart(item: MenuItem) {
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.menuItemId === item.id);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.menuItemId === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...current, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }
  function changeQuantity(menuItemId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => (item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  }

  return (
    <>
      <PageTitle title="Buyurtma" subtitle="Menyu va savatcha" />
      <div className="mb-4 flex gap-2 overflow-auto">
        <button className={`rounded-md px-3 py-2 text-sm ${categoryId === "all" ? "bg-teal-700 text-white" : "bg-white"}`} onClick={() => setCategoryId("all")}>Barchasi</button>
        {categories.map((category) => (
          <button key={category.id} className={`rounded-md px-3 py-2 text-sm ${categoryId === category.id ? "bg-teal-700 text-white" : "bg-white"}`} onClick={() => setCategoryId(category.id)}>
            {category.name}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items?.map((item) => (
            <Panel key={item.id}>
              <div className="mb-3 text-3xl">{item.emoji || "🍽"}</div>
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-slate-500">{item.price.toLocaleString("uz-UZ")} UZS</div>
              <button className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => addToCart(item)}>Qo'shish</button>
            </Panel>
          ))}
        </div>
        <Panel>
          <div className="mb-3 text-sm font-semibold">Savatcha</div>
          <div className="mb-3 grid gap-2">
            <select className="rounded-md border px-3 py-2 text-sm" value={tableId} onChange={(event) => setTableId(event.target.value)}>
              <option value="">Stol tanlang</option>
              {tables.data?.items.map((table) => (
                <option key={table.id} value={table.id}>Stol {table.number} · {table.status}</option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2 text-sm" type="number" min={1} value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value))} />
          </div>
          <div className="space-y-2">
            {cart.map((item) => (
              <div className="rounded-md bg-slate-50 p-3" key={item.menuItemId}>
                <div className="flex justify-between gap-2">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm">{(item.price * item.quantity).toLocaleString("uz-UZ")}</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="h-8 w-8 rounded-md border" onClick={() => changeQuantity(item.menuItemId, -1)}>-</button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <button className="h-8 w-8 rounded-md border" onClick={() => changeQuantity(item.menuItemId, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="my-4 flex justify-between border-t pt-3 font-semibold"><span>Jami</span><span>{total.toLocaleString("uz-UZ")} UZS</span></div>
          <button disabled={!tableId || cart.length === 0 || createOrder.isPending} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => createOrder.mutate()}>
            Oshxonaga yuborish
          </button>
        </Panel>
      </div>
    </>
  );
}
