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

    const { page, limit, skip } = getPagination(request);
    const where = { restaurantId: token.restaurantId, userId: token.userId };
    const [items, total] = await Promise.all([
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

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Shifts List Error]", error);
    return serverError("Smenalar ro'yxatini olishda xato");
  }
}
