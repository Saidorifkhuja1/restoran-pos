import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPagination, getRestaurantToken } from "@/lib/route-helpers";
import { serverError, success, unauthorized } from "@/lib/responses";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const startedAt =
      from || to
        ? {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          }
        : undefined;

    const { page, limit, skip } = getPagination(request);
    const where = {
      restaurantId: token.restaurantId,
      userId: token.userId,
      ...(startedAt ? { startedAt } : {}),
    };

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          totalSales: true,
          totalOrders: true,
          isActive: true,
        },
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.shift.count({ where }),
    ]);

    // Single aggregation query instead of N+1 per-shift queries
    if (shifts.length === 0) {
      return success({ items: [], total, page, limit });
    }

    const shiftRanges = shifts.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));

    const earliest = shiftRanges.reduce(
      (min, s) => (s.startedAt < min ? s.startedAt : min),
      shiftRanges[0]!.startedAt
    );
    const latest = shiftRanges.reduce(
      (max, s) => (s.endedAt && s.endedAt > max ? s.endedAt : max),
      new Date()
    );

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: token.restaurantId,
        waiterId: token.userId,
        status: { not: "CANCELLED" },
        createdAt: { gte: earliest, lte: latest },
      },
      select: {
        createdAt: true,
        items: {
          where: { status: { not: "CANCELLED" } },
          select: { price: true, quantity: true },
        },
      },
    });

    const items = shifts.map((shift) => {
      const shiftOrders = orders.filter(
        (o) =>
          o.createdAt >= shift.startedAt &&
          (shift.endedAt ? o.createdAt <= shift.endedAt : true)
      );
      const totalSales = shiftOrders.reduce(
        (sum, o) => sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0),
        0
      );
      return {
        ...shift,
        totalSales,
        totalOrders: shiftOrders.length,
      };
    });

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Shifts List Error]", error);
    return serverError("Smenalar ro'yxatini olishda xato");
  }
}
