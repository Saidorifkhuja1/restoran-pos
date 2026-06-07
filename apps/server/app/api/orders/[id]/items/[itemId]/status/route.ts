import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

const statusSchema = z.object({
  status: z.enum(["PENDING", "COOKING", "DONE", "CANCELLED"]),
});

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN] as const;

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const order = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: { id: true, status: true },
    });
    if (!order) return notFound("Buyurtma topilmadi");
    if (["BILL", "PAID", "CANCELLED"].includes(order.status)) {
      return forbidden("Yopilgan buyurtma taomlarini o'zgartirib bo'lmaydi");
    }

    if (token.role === UserRole.KITCHEN && !["COOKING", "DONE"].includes(parsed.data.status)) {
      return forbidden("KDS faqat tayyorlash statusini o'zgartiradi");
    }

    const existingItem = await prisma.orderItem.findFirst({
      where: { id: params.itemId, orderId: order.id },
      select: { id: true },
    });
    if (!existingItem) return notFound("Taom topilmadi");

    const { item, updatedOrder } = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.orderItem.update({
        where: { id: existingItem.id },
        data: {
          status: parsed.data.status,
          doneAt: parsed.data.status === "DONE" ? new Date() : null,
        },
        select: { id: true, orderId: true, status: true, doneAt: true },
      });

      const remaining = await tx.orderItem.count({
        where: { orderId: order.id, status: { notIn: ["DONE", "CANCELLED"] } },
      });
      const maybeUpdatedOrder =
        remaining === 0
          ? await tx.order.update({
              where: { id: order.id },
              data: { status: "READY", readyAt: new Date() },
              select: { id: true, status: true, readyAt: true },
            })
          : null;

      return { item: updatedItem, updatedOrder: maybeUpdatedOrder };
    });

    await publishEvent(restaurantChannel(token.restaurantId), "order:updated", {
      orderId: order.id,
      item,
      order: updatedOrder,
    });

    return success({ item, order: updatedOrder });
  } catch (error) {
    console.error("[Update Order Item Status Error]", error);
    return serverError("Taom statusini yangilashda xato");
  }
}
