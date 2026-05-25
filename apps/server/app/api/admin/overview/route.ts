import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReportSummary, utcDayStart } from "@/lib/report-summary";
import { serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const now = new Date();
    const today = await buildReportSummary(token.restaurantId, utcDayStart(now), now);
    const [restaurant, staff, zones, tables, categories, menuItems, suppliers, expenses, orders] = await Promise.all([
      prisma.restaurant.findFirst({
        where: { id: token.restaurantId, isActive: true },
        select: { id: true, name: true, type: true, logo: true, address: true, phone: true, taxId: true, taxPercent: true, currency: true, receiptFooter: true },
      }),
      prisma.user.findMany({
        where: { restaurantId: token.restaurantId, isActive: true },
        select: { id: true, name: true, phone: true, role: true, isActive: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.zone.findMany({
        where: { restaurantId: token.restaurantId, isActive: true },
        select: { id: true, name: true, color: true, sortOrder: true, _count: { select: { tables: true } } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.table.findMany({
        where: { restaurantId: token.restaurantId },
        select: { id: true, number: true, capacity: true, status: true, zoneId: true, zone: { select: { id: true, name: true } } },
        orderBy: [{ zone: { sortOrder: "asc" } }, { number: "asc" }],
      }),
      prisma.menuCategory.findMany({
        where: { restaurantId: token.restaurantId, isActive: true },
        select: { id: true, name: true, emoji: true, sortOrder: true, _count: { select: { items: true } } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.menuItem.findMany({
        where: { restaurantId: token.restaurantId, isActive: true },
        select: { id: true, name: true, price: true, emoji: true, image: true, isAvailable: true, category: { select: { id: true, name: true } } },
        orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
        take: 100,
      }),
      prisma.supplier.findMany({
        where: { restaurantId: token.restaurantId, isActive: true },
        select: { id: true, name: true, phone: true, contactPerson: true, category: true, balance: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.expense.findMany({
        where: { restaurantId: token.restaurantId, isActive: true },
        select: { id: true, name: true, amount: true, createdAt: true, user: { select: { name: true } }, supplier: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.order.findMany({
        where: { restaurantId: token.restaurantId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          table: { select: { number: true, zone: { select: { name: true } } } },
          waiter: { select: { name: true } },
          payment: { select: { totalAmount: true, method: true, paidAt: true } },
          items: { select: { price: true, quantity: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return success({ restaurant, summary: today.summary, staff, zones, tables, categories, menuItems, suppliers, expenses, orders });
  } catch (error) {
    console.error("[Admin Overview Error]", error);
    return serverError("Admin dashboard ma'lumotlarini olishda xato");
  }
}
