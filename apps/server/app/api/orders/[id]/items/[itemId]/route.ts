import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER] as const;

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const order = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: { id: true, status: true },
    });
    if (!order) return notFound("Buyurtma topilmadi");
    if (["BILL", "PAID", "CANCELLED"].includes(order.status)) {
      return forbidden("Bu buyurtmadan taom o'chirib bo'lmaydi");
    }

    const item = await prisma.orderItem.findFirst({
      where: { id: params.itemId, orderId: order.id },
      select: { id: true },
    });
    if (!item) return notFound("Taom topilmadi");

    const updated = await prisma.orderItem.update({
      where: { id: item.id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "order:updated", {
      orderId: order.id,
      item: updated,
    });

    return success(updated);
  } catch (error) {
    console.error("[Cancel Order Item Error]", error);
    return serverError("Taomni bekor qilishda xato");
  }
}
