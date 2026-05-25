import { z } from "zod";

// Validation schemas
export const createRestaurantSchema = z.object({
  name: z.string().min(2, "Restoran nomi kamida 2 ta harf bo'lishi kerak"),
  type: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  taxPercent: z.number().default(12),
  currency: z.string().default("UZS"),
  receiptFooter: z.string().optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  pin: z.string().min(4, "PIN kamida 4 ta raqam bo'lishi kerak").regex(/^\d+$/, "PIN faqat raqamlardan iborat bo'lishi kerak"),
  role: z.enum(["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"]),
});

export const loginSchema = z.object({
  restaurantId: z.string().uuid(),
  pin: z.string().min(4).regex(/^\d+$/),
});

export const superAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Utility functions
export function formatCurrency(amount: number, currency: string = "UZS"): string {
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date, locale: string = "uz-UZ"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function generateOrderNumber(sequence: number): string {
  return String(sequence).padStart(4, "0");
}

export function calculateChange(
  received: number,
  total: number
): number {
  return Math.max(0, received - total);
}
