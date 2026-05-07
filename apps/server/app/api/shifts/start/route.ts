import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError, success, unauthorized } from "@/lib/responses";
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
    });
    if (active) return badRequest("Faol smena allaqachon mavjud");

    const shift = await prisma.shift.create({
      data: { restaurantId: token.restaurantId, userId: token.userId },
      select: { id: true, startedAt: true, totalSales: true, totalOrders: true, isActive: true },
    });

    return success(shift, 201);
  } catch (error) {
    console.error("[Start Shift Error]", error);
    return serverError("Smenani boshlashda xato");
  }
}
