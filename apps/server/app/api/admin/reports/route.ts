import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedJson, setCachedJson } from "@/lib/redis";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;

function parseDate(value: string | null, fallback: Date): Date {
  return value ? new Date(value) : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.role === UserRole.CASHIER && new URL(request.url).searchParams.get("scope") === "staff") {
      return forbidden("Xodim hisobotlari uchun ruxsat yo'q");
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from = parseDate(searchParams.get("from"), dayStart);
    const to = parseDate(searchParams.get("to"), now);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return badRequest("Sana oralig'i noto'g'ri");
    }

    const cacheKey = `reports:${token.restaurantId}:${from.toISOString()}:${to.toISOString()}:${token.role}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) return success(cached);

    const paymentWhere = {
      restaurantId: token.restaurantId,
      paidAt: { gte: from, lte: to },
    };
    const orderWhere = {
      restaurantId: token.restaurantId,
      createdAt: { gte: from, lte: to },
    };

    const [payments, orderCount, expenses, topItems, staffSales, shifts] = await Promise.all([
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { totalAmount: true, discountAmount: true, taxAmount: true },
        _avg: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.order.count({ where: orderWhere }),
      prisma.expense.aggregate({
        where: { restaurantId: token.restaurantId, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.orderItem.groupBy({
        by: ["name"],
        where: {
          status: { not: "CANCELLED" },
          order: { restaurantId: token.restaurantId, createdAt: { gte: from, lte: to } },
        },
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      }),
      prisma.payment.groupBy({
        by: ["cashierId"],
        where: paymentWhere,
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.shift.findMany({
        where: { restaurantId: token.restaurantId, startedAt: { gte: from, lte: to } },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          totalSales: true,
          totalOrders: true,
          isActive: true,
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { startedAt: "desc" },
      }),
    ]);

    const cashiers = await prisma.user.findMany({
      where: { restaurantId: token.restaurantId, id: { in: staffSales.map((sale) => sale.cashierId) } },
      select: { id: true, name: true, role: true },
    });

    const report = {
      period: { from, to },
      summary: {
        revenue: payments._sum.totalAmount || 0,
        orders: orderCount,
        paidOrders: payments._count.id,
        averageCheck: Math.round(payments._avg.totalAmount || 0),
        discounts: payments._sum.discountAmount || 0,
        tax: payments._sum.taxAmount || 0,
        expenses: expenses._sum.amount || 0,
      },
      topItems: topItems.map((item) => ({
        name: item.name,
        quantity: item._sum.quantity || 0,
        gross: (item._sum.quantity || 0) * (item._sum.price || 0),
      })),
      staffSales: staffSales.map((sale) => ({
        user: cashiers.find((cashier) => cashier.id === sale.cashierId) || null,
        totalSales: sale._sum.totalAmount || 0,
        totalOrders: sale._count.id,
      })),
      shifts,
    };
    await setCachedJson(cacheKey, report, 60);
    return success(report);
  } catch (error) {
    console.error("[Reports Error]", error);
    return serverError("Hisobotni olishda xato");
  }
}
