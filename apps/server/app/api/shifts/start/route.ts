import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { badRequest, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const shift = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${token.restaurantId}:${token.userId}:shift`}))`;

      const active = await tx.shift.findFirst({
        where: { restaurantId: token.restaurantId, userId: token.userId, isActive: true },
        select: { id: true },
      });
      if (active) throw new Error("ACTIVE_SHIFT_EXISTS");

      return tx.shift.create({
        data: { restaurantId: token.restaurantId, userId: token.userId },
        select: { id: true, startedAt: true, totalSales: true, totalOrders: true, isActive: true },
      });
    });

    await publishEvent(restaurantChannel(token.restaurantId), "shift:updated", {
      action: "started",
      shift,
      userId: token.userId,
    });

    return success(shift, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_SHIFT_EXISTS") {
      return badRequest("Faol smena allaqachon mavjud");
    }
    console.error("[Start Shift Error]", error);
    return serverError("Smenani boshlashda xato");
  }
}
