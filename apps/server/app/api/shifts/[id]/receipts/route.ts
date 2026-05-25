import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestaurantToken } from "@/lib/route-helpers";
import { notFound, serverError, success, unauthorized } from "@/lib/responses";
import { UserRole } from "@restopos/types";

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    const { id } = await params;

    const shift = await prisma.shift.findFirst({
      where: { id, restaurantId: token.restaurantId, userId: token.userId },
      select: { id: true, startedAt: true, endedAt: true },
    });
    if (!shift) return notFound("Smena topilmadi");

    const createdAt = {
      gte: shift.startedAt,
      ...(shift.endedAt ? { lte: shift.endedAt } : {}),
    };

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: token.restaurantId,
        waiterId: token.userId,
        createdAt,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        table: { select: { number: true } },
        payment: { select: { id: true, receiptNumber: true, method: true, totalAmount: true, paidAt: true } },
        items: {
          where: { status: { not: "CANCELLED" } },
          select: {
            id: true,
            name: true,
            quantity: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const receipts = orders.map((order) => ({
      id: order.payment?.id || order.id,
      receiptNumber: order.payment?.receiptNumber || null,
      method: order.payment?.method || order.status,
      totalAmount: order.payment?.totalAmount || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      paidAt: order.payment?.paidAt || order.createdAt,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        table: order.table,
        items: order.items,
      },
    }));

    return success(receipts);
  } catch (error) {
    console.error("[Shift Receipts Error]", error);
    return serverError("Smena cheklarini olishda xato");
  }
}
