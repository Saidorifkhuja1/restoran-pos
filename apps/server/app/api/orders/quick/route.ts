import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const quickOrderSchema = z.object({
  type: z.enum(["delivery", "takeaway"]),
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
  waiterId: z.string().min(1),
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
        id: { in: data.items.map((i) => i.menuItemId) },
        isActive: true,
        isAvailable: true,
      },
      select: { id: true, name: true, price: true },
    });

    if (menuItems.length !== new Set(data.items.map((i) => i.menuItemId)).size) {
      return badRequest("Menyu elementi topilmadi yoki mavjud emas");
    }

    const waiter = await prisma.user.findFirst({
      where: { id: data.waiterId, restaurantId: token.restaurantId, role: UserRole.WAITER, isActive: true },
      select: { id: true },
    });
    if (!waiter) return badRequest("Ofitsiant topilmadi");

    const subtotal = data.items.reduce((sum, item) => {
      const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
      return sum + (menuItem?.price ?? 0) * item.quantity;
    }, 0);
    if (subtotal <= 0) return badRequest("Buyurtma summasi noto'g'ri");

    // Use first available table as placeholder because Order.tableId is required.
    // The table state is intentionally not changed for delivery/takeaway orders.
    const anyTable = await prisma.table.findFirst({
      where: { restaurantId: token.restaurantId },
      select: { id: true },
    });
    if (!anyTable) return badRequest("Stol topilmadi. Avval bitta stol yarating.");

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
          tableId: anyTable.id,
          waiterId: waiter.id,
          orderNumber: counter.orderSeq,
          guestCount: 1,
          note: data.type === "delivery" ? "Kurier" : "Olib ketish",
          status: "PAID",
          sentToKitchenAt: new Date(),
          readyAt: new Date(),
          billedAt: new Date(),
          paidAt: new Date(),
          items: {
            create: data.items.map((item) => {
              const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
              return {
                menuItemId: item.menuItemId,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity,
                status: "DONE",
                doneAt: new Date(),
              };
            }),
          },
        },
        select: { id: true, orderNumber: true, status: true, note: true },
      });

      // Create payment
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
          paidAt: new Date(),
        },
      });

      return created;
    });

    return success(order, 201);
  } catch (error) {
    console.error("[Quick Order Error]", error);
    return serverError("Tezkor buyurtma yaratishda xato");
  }
}
