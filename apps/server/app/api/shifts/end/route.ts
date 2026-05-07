import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const active = await prisma.shift.findFirst({
      where: { restaurantId: token.restaurantId, userId: token.userId, isActive: true },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    });
    if (!active) return notFound("Faol smena topilmadi");

    const shift = await prisma.shift.update({
      where: { id: active.id },
      data: { isActive: false, endedAt: new Date() },
      select: { id: true, startedAt: true, endedAt: true, totalSales: true, totalOrders: true, isActive: true },
    });

    return success(shift);
  } catch (error) {
    console.error("[End Shift Error]", error);
    return serverError("Smenani yopishda xato");
  }
}
