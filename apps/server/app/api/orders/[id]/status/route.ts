import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { cashierChannel, publishEvent, restaurantChannel } from "@/lib/pusher";
import { writeAuditLog } from "@/lib/audit";
import { UserRole, OrderStatus } from "@restopos/types";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const statusSchema = z.object({
  status: z.enum(["OPEN", "IN_KITCHEN", "READY", "BILL", "CANCELLED"]),
});

// Allowed status transitions — defines valid business flow
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ["IN_KITCHEN", "CANCELLED"],
  IN_KITCHEN: ["READY", "CANCELLED"],
  READY: ["BILL", "CANCELLED"],
  BILL: ["CANCELLED"], // BILL → PAID only via /payment endpoint
  PAID: [],            // Terminal state
  CANCELLED: [],       // Terminal state
} as const;

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const existing = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: { id: true, tableId: true, status: true },
    });
    if (!existing) return notFound("Buyurtma topilmadi");

    const nextStatus = parsed.data.status;

    // Validate status transition
    const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(nextStatus)) {
      return badRequest(
        `Statusni "${existing.status}" dan "${nextStatus}" ga o'zgartirib bo'lmaydi`
      );
    }

    // Role-based restrictions
    if (token.role === UserRole.KITCHEN && nextStatus !== "READY") {
      return forbidden("KDS faqat READY statusini o'zgartiradi");
    }
    if (token.role === UserRole.CASHIER) {
      return forbidden("Kassir faqat to'lov orqali statusni o'zgartiradi");
    }
    if (token.role === UserRole.WAITER && !["IN_KITCHEN", "BILL"].includes(nextStatus)) {
      return forbidden("Bu statusni o'zgartirishga ruxsat yo'q");
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: params.id },
        data: {
          status: nextStatus,
          sentToKitchenAt: nextStatus === "IN_KITCHEN" ? new Date() : undefined,
          readyAt: nextStatus === "READY" ? new Date() : undefined,
          billedAt: nextStatus === "BILL" ? new Date() : undefined,
        },
        select: { id: true, restaurantId: true, orderNumber: true, status: true, tableId: true },
      });

      if (nextStatus === "BILL") {
        await tx.table.update({ where: { id: existing.tableId }, data: { status: "BILL_REQUESTED" } });
      }

      if (nextStatus === "CANCELLED") {
        await tx.table.update({
          where: { id: existing.tableId },
          data: { status: "FREE", currentOrderId: null },
        });
      }

      return updated;
    });

    await Promise.all([
      writeAuditLog(request, {
        restaurantId: token.restaurantId,
        action: "STATUS_UPDATE",
        entity: "Order",
        entityId: order.id,
        metadata: { from: existing.status, to: nextStatus },
      }),
      publishEvent(restaurantChannel(token.restaurantId), "order:updated", order),
      nextStatus === "BILL"
        ? publishEvent(cashierChannel(token.restaurantId), "bill-requested", order)
        : Promise.resolve(),
      publishEvent(restaurantChannel(token.restaurantId), "table:status", {
        tableId: existing.tableId,
        status: nextStatus === "BILL" ? "BILL_REQUESTED" : nextStatus === "CANCELLED" ? "FREE" : undefined,
      }),
    ]);

    return success(order);
  } catch (error) {
    console.error("[Update Order Status Error]", error);
    return serverError("Buyurtma statusini yangilashda xato");
  }
}

