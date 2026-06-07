import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

const quickOrderSchema = z.object({
  type: z.enum(["delivery", "takeaway"]),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = quickOrderSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const data = parsed.data;
    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId: token.restaurantId,
        id: { in: data.items.map((item) => item.menuItemId) },
        isActive: true,
        isAvailable: true,
      },
      select: { id: true, name: true, price: true },
    });

    if (menuItems.length !== new Set(data.items.map((item) => item.menuItemId)).size) {
      return badRequest("Menyu elementi topilmadi yoki mavjud emas");
    }

    const cashier = await prisma.user.findFirst({
      where: {
        id: token.userId,
        restaurantId: token.restaurantId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!cashier) return badRequest("Kassir topilmadi");

    const subtotal = data.items.reduce((sum, item) => {
      const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
      return sum + (menuItem?.price ?? 0) * item.quantity;
    }, 0);
    if (subtotal <= 0) return badRequest("Buyurtma summasi noto'g'ri");

    // Order.tableId is required, but quick orders must not change table state.
    const placeholderTable = await prisma.table.findFirst({
      where: { restaurantId: token.restaurantId },
      select: { id: true },
    });
    if (!placeholderTable) return badRequest("Avval kamida bitta stol yarating");

    const now = new Date();
    const order = await prisma.$transaction(async (tx) => {
      const counter = await tx.restaurantCounter.upsert({
        where: { restaurantId: token.restaurantId },
        update: { orderSeq: { increment: 1 } },
        create: { restaurantId: token.restaurantId, orderSeq: 1 },
        select: { orderSeq: true },
      });

      const created = await tx.order.create({
        data: {
          restaurantId: token.restaurantId,
          tableId: placeholderTable.id,
          waiterId: cashier.id,
          orderNumber: counter.orderSeq,
          guestCount: 1,
          note: data.type === "delivery" ? "Kuryer" : "Olib ketish",
          status: "PAID",
          sentToKitchenAt: now,
          readyAt: now,
          billedAt: now,
          paidAt: now,
          items: {
            create: data.items.map((item) => {
              const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId)!;
              return {
                menuItemId: item.menuItemId,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity,
                status: "DONE",
                doneAt: now,
              };
            }),
          },
        },
        select: { id: true, orderNumber: true, status: true, note: true },
      });

      const receiptCounter = await tx.restaurantCounter.update({
        where: { restaurantId: token.restaurantId },
        data: { receiptSeq: { increment: 1 } },
        select: { receiptSeq: true },
      });

      await tx.payment.create({
        data: {
          restaurantId: token.restaurantId,
          orderId: created.id,
          cashierId: token.userId,
          method: "CASH",
          subtotal,
          taxPercent: 0,
          taxAmount: 0,
          totalAmount: subtotal,
          receiptNumber: `#${String(receiptCounter.receiptSeq).padStart(4, "0")}`,
          receiptPrinted: false,
          paidAt: now,
        },
      });

      return created;
    });

    await publishEvent(restaurantChannel(token.restaurantId), "order:created", order);
    return success(order, 201);
  } catch (error) {
    console.error("[Quick Order Error]", error);
    return serverError("Tezkor buyurtma yaratishda xato");
  }
}
