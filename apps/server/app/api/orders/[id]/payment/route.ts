import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { cashierChannel, publishEvent, restaurantChannel } from "@/lib/pusher";
import { deleteCacheByPattern } from "@/lib/redis";
import { writeAuditLog } from "@/lib/audit";
import { UserRole } from "@restopos/types";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "QR", "MIXED"]),
  discountId: z.string().min(1).optional(),
  receivedAmount: z.number().int().nonnegative().optional(),
  cashAmount: z.number().int().nonnegative().default(0),
  cardAmount: z.number().int().nonnegative().default(0),
  receiptPrinted: z.boolean().default(false),
});

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;

function formatReceiptNumber(value: number): string {
  return `#${value.toString().padStart(4, "0")}`;
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const order = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: {
        id: true,
        tableId: true,
        status: true,
        items: { select: { price: true, quantity: true, status: true } },
        restaurant: { select: { taxPercent: true } },
        payment: { select: { id: true } },
      },
    });

    if (!order) return notFound("Buyurtma topilmadi");
    if (order.payment) return badRequest("Bu buyurtma uchun to'lov qabul qilingan");
    if (order.status === "CANCELLED") return forbidden("Bekor qilingan buyurtmani to'lab bo'lmaydi");

    const data = parsed.data;
    const subtotal = order.items
      .filter((item) => item.status !== "CANCELLED")
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    let discountPercent = 0;
    let discountAmount = 0;
    if (data.discountId) {
      const discount = await prisma.discount.findFirst({
        where: { id: data.discountId, restaurantId: token.restaurantId, isActive: true },
        select: { id: true, type: true, value: true },
      });
      if (!discount) return badRequest("Chegirma topilmadi");

      discountAmount =
        discount.type === "PERCENT"
          ? Math.round((subtotal * discount.value) / 100)
          : Math.min(discount.value, subtotal);
      discountPercent = discount.type === "PERCENT" ? discount.value : 0;
    }

    const taxable = Math.max(0, subtotal - discountAmount);
    const taxPercent = order.restaurant.taxPercent;
    const taxAmount = Math.round((taxable * taxPercent) / 100);
    const totalAmount = taxable + taxAmount;

    if (data.method === "CASH" && (data.receivedAmount ?? 0) < totalAmount) {
      return badRequest("Naqd qabul qilingan summa yetarli emas");
    }

    if (data.method === "MIXED" && data.cashAmount + data.cardAmount !== totalAmount) {
      return badRequest("Mixed to'lov summasi yakuniy summaga teng bo'lishi kerak");
    }

    const payment = await prisma.$transaction(async (tx) => {
      const count = await tx.payment.count({ where: { restaurantId: token.restaurantId } });
      const receiptNumber = formatReceiptNumber(count + 1);
      const created = await tx.payment.create({
        data: {
          restaurantId: token.restaurantId,
          orderId: order.id,
          cashierId: token.userId,
          method: data.method,
          subtotal,
          discountId: data.discountId,
          discountPercent,
          discountAmount,
          taxPercent,
          taxAmount,
          totalAmount,
          receivedAmount: data.receivedAmount,
          changeAmount: data.method === "CASH" ? (data.receivedAmount ?? 0) - totalAmount : 0,
          cashAmount: data.method === "MIXED" ? data.cashAmount : data.method === "CASH" ? totalAmount : 0,
          cardAmount: data.method === "MIXED" ? data.cardAmount : data.method === "CARD" ? totalAmount : 0,
          receiptNumber,
          receiptPrinted: data.receiptPrinted,
        },
        select: {
          id: true,
          orderId: true,
          method: true,
          subtotal: true,
          discountPercent: true,
          discountAmount: true,
          taxPercent: true,
          taxAmount: true,
          totalAmount: true,
          receivedAmount: true,
          changeAmount: true,
          cardAmount: true,
          cashAmount: true,
          receiptNumber: true,
          receiptPrinted: true,
          paidAt: true,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.table.update({
        where: { id: order.tableId },
        data: { status: "FREE", currentOrderId: null },
      });
      await tx.shift.updateMany({
        where: { restaurantId: token.restaurantId, userId: token.userId, isActive: true },
        data: { totalSales: { increment: totalAmount }, totalOrders: { increment: 1 } },
      });

      return created;
    });

    await Promise.all([
      writeAuditLog(request, {
        restaurantId: token.restaurantId,
        action: "CREATE",
        entity: "Payment",
        entityId: payment.id,
        metadata: { orderId: order.id, totalAmount: payment.totalAmount, method: payment.method },
      }),
      deleteCacheByPattern(`reports:${token.restaurantId}:*`),
      publishEvent(cashierChannel(token.restaurantId), "payment-done", payment),
      publishEvent(restaurantChannel(token.restaurantId), "order:updated", {
        orderId: order.id,
        status: "PAID",
      }),
      publishEvent(restaurantChannel(token.restaurantId), "table:status", {
        tableId: order.tableId,
        status: "FREE",
        currentOrderId: null,
      }),
    ]);

    return success(payment, 201);
  } catch (error) {
    console.error("[Create Payment Error]", error);
    return serverError("To'lovni yakunlashda xato");
  }
}
