import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string }> };

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER] as const;

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const reservation = await prisma.reservation.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: { id: true, tableId: true, guestCount: true, note: true, status: true, order: { select: { id: true } } },
    });
    if (!reservation) return notFound("Bron topilmadi");
    if (reservation.order) return badRequest("Bu bron uchun order allaqachon yaratilgan");
    if (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW") return forbidden("Bu bron faol emas");

    const order = await prisma.$transaction(async (tx) => {
      const last = await tx.order.findFirst({
        where: { restaurantId: token.restaurantId },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      const created = await tx.order.create({
        data: {
          restaurantId: token.restaurantId,
          tableId: reservation.tableId,
          reservationId: reservation.id,
          waiterId: token.userId,
          orderNumber: (last?.orderNumber || 0) + 1,
          guestCount: reservation.guestCount,
          note: reservation.note,
          status: "OPEN",
        },
        select: { id: true, orderNumber: true, status: true, tableId: true },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "ARRIVED", arrivedAt: new Date() },
      });
      await tx.table.update({
        where: { id: reservation.tableId },
        data: { status: "OCCUPIED", currentOrderId: created.id },
      });

      return created;
    });

    await Promise.all([
      publishEvent(restaurantChannel(token.restaurantId), "order:created", order),
      publishEvent(restaurantChannel(token.restaurantId), "table:status", {
        tableId: order.tableId,
        status: "OCCUPIED",
        currentOrderId: order.id,
      }),
    ]);

    return success(order, 201);
  } catch (error) {
    console.error("[Arrive Reservation Error]", error);
    return serverError("Bronni keldi qilishda xato");
  }
}
