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

    const paidAt = {
      gte: shift.startedAt,
      ...(shift.endedAt ? { lte: shift.endedAt } : {}),
    };

    const receipts = await prisma.payment.findMany({
      where: {
        restaurantId: token.restaurantId,
        paidAt,
        order: { waiterId: token.userId },
      },
      select: {
        id: true,
        receiptNumber: true,
        method: true,
        totalAmount: true,
        paidAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            table: { select: { number: true } },
            items: {
              select: {
                id: true,
                name: true,
                quantity: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    return success(receipts);
  } catch (error) {
    console.error("[Shift Receipts Error]", error);
    return serverError("Smena cheklarini olishda xato");
  }
}
