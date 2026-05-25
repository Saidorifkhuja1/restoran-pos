import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const updateOrderSchema = z.object({
  guestCount: z.number().int().positive().optional(),
  note: z.string().max(500).nullable().optional(),
});

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const order = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId, ...(token.role === UserRole.WAITER ? { waiterId: token.userId } : {}) },
      select: {
        id: true,
        restaurantId: true,
        orderNumber: true,
        status: true,
        guestCount: true,
        note: true,
        createdAt: true,
        sentToKitchenAt: true,
        readyAt: true,
        billedAt: true,
        paidAt: true,
        table: { select: { id: true, number: true, status: true } },
        waiter: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            menuItemId: true,
            name: true,
            price: true,
            quantity: true,
            note: true,
            status: true,
            doneAt: true,
          },
        },
        payment: { select: { id: true, totalAmount: true, method: true, paidAt: true } },
      },
    });

    if (!order) return notFound("Buyurtma topilmadi");
    return success(order);
  } catch (error) {
    console.error("[Get Order Error]", error);
    return serverError("Buyurtmani olishda xato");
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER] as const);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = updateOrderSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const existing = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId, ...(token.role === UserRole.WAITER ? { waiterId: token.userId } : {}) },
      select: { id: true },
    });
    if (!existing) return notFound("Buyurtma topilmadi");

    const order = await prisma.order.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, restaurantId: true, orderNumber: true, status: true, guestCount: true, note: true },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "order:updated", order);
    return success(order);
  } catch (error) {
    console.error("[Update Order Error]", error);
    return serverError("Buyurtmani yangilashda xato");
  }
}
