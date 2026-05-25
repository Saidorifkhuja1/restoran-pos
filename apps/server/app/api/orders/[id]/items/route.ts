import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { kitchenChannel, publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string }> };

const itemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  note: z.string().max(300).optional(),
});

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER] as const;

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = itemSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const order = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId, ...(token.role === UserRole.WAITER ? { waiterId: token.userId } : {}) },
      select: { id: true, status: true },
    });
    if (!order) return notFound("Buyurtma topilmadi");
    if (["BILL", "PAID", "CANCELLED"].includes(order.status)) {
      return forbidden("Bu buyurtmaga taom qo'shib bo'lmaydi");
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id: parsed.data.menuItemId,
        restaurantId: token.restaurantId,
        isActive: true,
        isAvailable: true,
      },
      select: { id: true, name: true, price: true },
    });
    if (!menuItem) return badRequest("Menyu elementi topilmadi");

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: parsed.data.quantity,
          note: parsed.data.note,
          status: "COOKING",
        },
        select: {
          id: true,
          menuItemId: true,
          name: true,
          price: true,
          quantity: true,
          note: true,
          status: true,
        },
      });
      if (order.status === "OPEN") {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "IN_KITCHEN", sentToKitchenAt: new Date() },
        });
      }
      return created;
    });

    await Promise.all([
      publishEvent(restaurantChannel(token.restaurantId), "order:updated", { orderId: order.id, item }),
      publishEvent(kitchenChannel(token.restaurantId), "new-order", { orderId: order.id, item }),
    ]);

    return success(item, 201);
  } catch (error) {
    console.error("[Add Order Item Error]", error);
    return serverError("Taom qo'shishda xato");
  }
}
