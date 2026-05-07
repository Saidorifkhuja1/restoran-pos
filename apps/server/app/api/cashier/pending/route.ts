import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const { page, limit, skip } = getPagination(request);
    const where = { restaurantId: token.restaurantId, status: "BILL" as const };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          guestCount: true,
          billedAt: true,
          table: { select: { id: true, number: true } },
          waiter: { select: { id: true, name: true } },
          items: {
            where: { status: { not: "CANCELLED" } },
            select: { id: true, name: true, price: true, quantity: true },
          },
        },
        orderBy: { billedAt: "asc" },
      }),
      prisma.order.count({ where }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Cashier Pending Error]", error);
    return serverError("Kutilayotgan hisoblarni olishda xato");
  }
}
