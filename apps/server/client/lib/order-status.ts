export type OrderDisplayStatus = "created" | "delivered" | "paid" | "cancelled";

export const orderDisplayStatuses: { value: OrderDisplayStatus; label: string }[] = [
  { value: "created", label: "Yaratildi" },
  { value: "delivered", label: "Berildi" },
  { value: "paid", label: "To'landi" },
  { value: "cancelled", label: "Bekor qilindi" },
];

export function orderDisplayStatus(status: string): OrderDisplayStatus {
  if (status === "PAID") return "paid";
  if (status === "CANCELLED") return "cancelled";
  if (status === "READY" || status === "BILL") return "delivered";
  return "created";
}

export function orderDisplayStatusLabel(status: string): string {
  const displayStatus = orderDisplayStatus(status);
  return orderDisplayStatuses.find((item) => item.value === displayStatus)?.label ?? "Yaratildi";
}
