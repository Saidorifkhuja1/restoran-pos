import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext, serverError, success, unauthorized } from "@/lib/responses";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isSuperAdmin) return unauthorized("SuperAdmin ruxsat kerak");

    const [restaurants, activeRestaurants, orders, revenue, users] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.payment.aggregate({ _sum: { totalAmount: true } }),
      prisma.user.count({ where: { isActive: true } }),
    ]);

    return success({
      restaurants,
      activeRestaurants,
      inactiveRestaurants: restaurants - activeRestaurants,
      orders,
      revenue: revenue._sum.totalAmount || 0,
      users,
    });
  } catch (error) {
    console.error("[SuperAdmin Stats Error]", error);
    return serverError("Platform statistikasini olishda xato");
  }
}
