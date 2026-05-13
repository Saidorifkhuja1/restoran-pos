"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useReactToPrint } from "react-to-print";
import { z } from "zod";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { Modal, PageTitle, Panel } from "@/client/components/ui";
import { usePusherEvent } from "@/client/hooks/usePusher";
import { useAuthStore } from "@/client/store/authStore";

type PendingOrder = {
  id: string;
  orderNumber: number;
  guestCount?: number | null;
  table: { number: number };
  waiter: { name: string };
  items: { id: string; name: string; price: number; quantity: number }[];
};
type Discount = { id: string; name: string; type: "PERCENT" | "FIXED"; value: number };
type Settings = { autoPrintReceipt: boolean };
type PaymentMethod = "CASH" | "CARD" | "QR" | "MIXED";
type PaymentResponse = { receiptNumber?: string | null; method: PaymentMethod; totalAmount: number };

const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "QR", "MIXED"]),
  discountId: z.string().optional(),
  receivedAmount: z.coerce.number().min(0),
  cashAmount: z.coerce.number().min(0),
  cardAmount: z.coerce.number().min(0),
});
type PaymentForm = z.infer<typeof paymentSchema>;

export function CashierPage() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((state) => state.restaurant);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [previewOrder, setPreviewOrder] = useState<PendingOrder | null>(null);
  const [paidReceipt, setPaidReceipt] = useState<PaymentResponse | null>(null);
  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: "CASH", discountId: "", receivedAmount: 0, cashAmount: 0, cardAmount: 0 },
  });
  const method = form.watch("method");
  const discountId = form.watch("discountId") || "";
  const receivedAmount = form.watch("receivedAmount");
  const receiptRef = useRef<HTMLDivElement>(null);
  const printReceipt = useReactToPrint({ contentRef: receiptRef });

  usePusherEvent(restaurant?.id ? `cashier:${restaurant.id}` : null, "bill-requested", () => {
    void queryClient.invalidateQueries({ queryKey: ["cashier-pending"] });
  });
  usePusherEvent(restaurant?.id ? `cashier:${restaurant.id}` : null, "payment-done", () => {
    void queryClient.invalidateQueries({ queryKey: ["cashier-pending"] });
  });

  const pending = useQuery({
    queryKey: ["cashier-pending"],
    queryFn: () => getData<Paginated<PendingOrder>>("/cashier/pending?limit=50"),
    refetchInterval: 10_000,
  });
  const discounts = useQuery({
    queryKey: ["discounts"],
    queryFn: () => getData<Paginated<Discount>>("/admin/discounts?limit=100"),
  });
  const settings = useQuery({
    queryKey: ["settings", restaurant?.id],
    enabled: Boolean(restaurant?.id),
    queryFn: () => getData<Settings>(`/restaurants/${restaurant?.id}/settings`),
  });
  const selectedTotal = useMemo(
    () => selectedOrder?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0,
    [selectedOrder]
  );
  const selectedDiscount = discounts.data?.items.find((discount) => discount.id === discountId);
  const discountAmount = selectedDiscount
    ? selectedDiscount.type === "PERCENT"
      ? Math.round((selectedTotal * selectedDiscount.value) / 100)
      : Math.min(selectedDiscount.value, selectedTotal)
    : 0;
  const taxAmount = Math.round((selectedTotal - discountAmount) * ((restaurant?.taxPercent || 12) / 100));
  const finalTotal = Math.max(0, selectedTotal - discountAmount + taxAmount);

  const pay = useMutation({
    mutationFn: ({ order, values }: { order: { id: string }; values: PaymentForm }) =>
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
      if (settings.data?.autoPrintReceipt) {
        setTimeout(() => printReceipt(), 50);
      }
      setSelectedOrder(null);
      await queryClient.invalidateQueries({ queryKey: ["cashier-pending"] });
    },
  });

  function openPayment(order: PendingOrder, total: number) {
    setSelectedOrder(order);
    setPreviewOrder(order);
    setPaidReceipt(null);
    form.reset({
      method: "CASH",
      discountId: "",
      receivedAmount: Math.round(total * (1 + (restaurant?.taxPercent || 12) / 100)),
      cashAmount: 0,
      cardAmount: 0,
    });
  }
  useEffect(() => {
    if (method === "CASH") form.setValue("receivedAmount", Math.max(receivedAmount, finalTotal));
  }, [finalTotal, form, method, receivedAmount]);

  return (
    <>
      <PageTitle title="Kassa" subtitle="Hisob kutayotgan buyurtmalar" />
      <div className="grid gap-3 lg:grid-cols-2">
        {pending.isLoading ? <Panel><div className="text-sm text-slate-500">Yuklanmoqda...</div></Panel> : null}
        {pending.data?.items.map((order) => {
          const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return (
            <Panel key={order.id}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="font-semibold">#{order.orderNumber} · Stol {order.table.number}</div>
                <div className="font-semibold">{total.toLocaleString("uz-UZ")} UZS</div>
              </div>
              <div className="mb-4 text-sm text-slate-500">Ofitsiant: {order.waiter.name}</div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => openPayment(order, total)}>To'lash</button>
                <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={() => { setPreviewOrder(order); setTimeout(() => printReceipt(), 50); }}>Print</button>
                <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setPreviewOrder(order)}>80mm preview</button>
              </div>
            </Panel>
          );
        })}
      </div>
      {selectedOrder ? (
        <Modal title={`To'lov #${selectedOrder.orderNumber}`} onClose={() => setSelectedOrder(null)}>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => pay.mutate({ order: selectedOrder, values }))}>
            <select aria-label="To'lov usuli" className="w-full rounded-md border px-3 py-2" {...form.register("method")}>
              <option value="CASH">CASH</option><option value="CARD">CARD</option><option value="QR">QR</option><option value="MIXED">MIXED</option>
            </select>
            <select aria-label="Chegirma" className="w-full rounded-md border px-3 py-2" {...form.register("discountId")}>
              <option value="">Chegirma yo'q</option>
              {discounts.data?.items.map((discount) => <option value={discount.id} key={discount.id}>{discount.name}</option>)}
            </select>
            {method === "CASH" ? <input aria-label="Qabul qilingan summa" className="w-full rounded-md border px-3 py-2" type="number" {...form.register("receivedAmount")} /> : null}
            {method === "MIXED" ? (
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Naqd summa" className="rounded-md border px-3 py-2" type="number" placeholder="Naqd" {...form.register("cashAmount")} />
                <input aria-label="Karta summa" className="rounded-md border px-3 py-2" type="number" placeholder="Karta" {...form.register("cardAmount")} />
              </div>
            ) : null}
            <ReceiptTotals subtotal={selectedTotal} discount={discountAmount} tax={taxAmount} total={finalTotal} change={method === "CASH" ? Math.max(0, receivedAmount - finalTotal) : undefined} />
            {pay.error ? <div className="text-sm text-rose-600">To'lov yakunlanmadi</div> : null}
            <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pay.isPending}>{pay.isPending ? "Yakunlanmoqda..." : "To'lovni yakunlash"}</button>
          </form>
        </Modal>
      ) : null}
      {previewOrder ? (
        <Modal title="80mm chek preview" onClose={() => setPreviewOrder(null)}>
          <div ref={receiptRef} className="mx-auto w-[302px] bg-white p-4 font-mono text-[12px] text-slate-950 print:w-[80mm] print:p-2">
            <div className="text-center text-base font-bold">{restaurant?.name || "RestoPOS"}</div>
            <div className="text-center text-[10px] text-slate-500">{new Date().toLocaleString("uz-UZ")}</div>
            <div className="my-2 border-t border-dashed border-slate-400" />
            <div className="flex justify-between"><span>Stol</span><span>{previewOrder.table.number}</span></div>
            <div className="flex justify-between"><span>Chek</span><span>{paidReceipt?.receiptNumber || `#${previewOrder.orderNumber}`}</span></div>
            <div className="flex justify-between"><span>Ofitsiant</span><span>{previewOrder.waiter.name}</span></div>
            {previewOrder.guestCount ? <div className="flex justify-between"><span>Mehmon</span><span>{previewOrder.guestCount}</span></div> : null}
            <div className="my-2 border-t border-dashed border-slate-400" />
            {previewOrder.items.map((item) => (
              <div className="mb-1" key={item.id}>
                <div>{item.name}</div>
                <div className="flex justify-between"><span>{item.quantity} x {item.price.toLocaleString("uz-UZ")}</span><span>{(item.quantity * item.price).toLocaleString("uz-UZ")}</span></div>
              </div>
            ))}
            <div className="my-2 border-t border-dashed border-slate-400" />
            <ReceiptTotals subtotal={selectedOrder?.id === previewOrder.id ? selectedTotal : previewOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0)} discount={selectedOrder?.id === previewOrder.id ? discountAmount : 0} tax={selectedOrder?.id === previewOrder.id ? taxAmount : Math.round(previewOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * ((restaurant?.taxPercent || 12) / 100))} total={selectedOrder?.id === previewOrder.id ? finalTotal : Math.round(previewOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 + (restaurant?.taxPercent || 12) / 100))} />
            <div className="mt-2 flex justify-between"><span>To'lov</span><span>{paidReceipt?.method || method}</span></div>
            <div className="mt-3 text-center">Rahmat!</div>
          </div>
          <button className="mt-3 w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={() => printReceipt()}>Print</button>
        </Modal>
      ) : null}
    </>
  );
}

function ReceiptTotals({ subtotal, discount, tax, total, change }: { subtotal: number; discount: number; tax: number; total: number; change?: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm print:bg-white print:p-0">
      <div className="flex justify-between"><span>Subtotal</span><span>{subtotal.toLocaleString("uz-UZ")}</span></div>
      <div className="flex justify-between"><span>Chegirma</span><span>{discount.toLocaleString("uz-UZ")}</span></div>
      <div className="flex justify-between"><span>QQS</span><span>{tax.toLocaleString("uz-UZ")}</span></div>
      <div className="flex justify-between font-semibold"><span>Jami</span><span>{total.toLocaleString("uz-UZ")}</span></div>
      {change !== undefined ? <div className="flex justify-between"><span>Qaytim</span><span>{change.toLocaleString("uz-UZ")}</span></div> : null}
    </div>
  );
}
