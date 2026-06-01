import { prisma } from "@/lib/prisma";

export type ReportSummary = {
  period: { from: Date; to: Date };
  summary: {
    revenue: number;
    orders: number;
    paidOrders: number;
    averageCheck: number;
    discounts: number;
    tax: number;
    expenses: number;
  };
  topItems: { name: string; quantity: number; gross: number }[];
  staffSales: {
    user: { id: string; name: string; role: string } | null;
    totalSales: number;
    totalOrders: number;
  }[];
  shifts: {
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    totalSales: number;
    totalOrders: number;
    isActive: boolean;
    user: { id: string; name: string; role: string };
  }[];
};

export function parseReportDate(value: string | null, fallback: Date): Date {
  return value ? new Date(value) : fallback;
}

export function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcWeekStart(date: Date): Date {
  const start = utcDayStart(date);
  const day = start.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setUTCDate(start.getUTCDate() - diff);
  return start;
}

export async function buildReportSummary(restaurantId: string, from: Date, to: Date): Promise<ReportSummary> {
  const paymentWhere = {
    restaurantId,
    paidAt: { gte: from, lte: to },
  };
  const orderWhere = {
    restaurantId,
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
      where: { restaurantId, isActive: true, createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.orderItem.groupBy({
      by: ["name", "price"],
      where: {
        status: { not: "CANCELLED" },
        order: { restaurantId, payment: { paidAt: { gte: from, lte: to } } },
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
      where: { restaurantId, startedAt: { gte: from, lte: to } },
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
    where: { restaurantId, id: { in: staffSales.map((sale) => sale.cashierId) } },
    select: { id: true, name: true, role: true },
  });

  return {
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
    topItems: Object.values(
      topItems.reduce<Record<string, { name: string; quantity: number; gross: number }>>((acc, item) => {
        const current = acc[item.name] || { name: item.name, quantity: 0, gross: 0 };
        const quantity = item._sum.quantity || 0;
        current.quantity += quantity;
        current.gross += quantity * item.price;
        acc[item.name] = current;
        return acc;
      }, {})
    ).sort((left, right) => right.quantity - left.quantity),
    staffSales: staffSales.map((sale) => ({
      user: cashiers.find((cashier) => cashier.id === sale.cashierId) || null,
      totalSales: sale._sum.totalAmount || 0,
      totalOrders: sale._count.id,
    })),
    shifts,
  };
}
