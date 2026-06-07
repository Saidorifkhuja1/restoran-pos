import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { syncTableState } from "@/lib/table-status";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string }> };
const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER] as const;
const transferSchema = z.object({ targetTableId: z.string().min(1) });

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    const parsed = transferSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const existing = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId, ...(token.role === UserRole.WAITER ? { waiterId: token.userId } : {}) },
      select: { id: true, orderNumber: true, tableId: true, status: true, note: true },
    });
    if (!existing) return notFound("Chek topilmadi");
    if (["PAID", "CANCELLED"].includes(existing.status)) return forbidden("Yopilgan chekni ko'chirib bo'lmaydi");
    if (existing.note === "Kuryer" || existing.note === "Olib ketish") return forbidden("Bu chek stolga tegishli emas");
    if (existing.tableId === parsed.data.targetTableId) return badRequest("Chek allaqachon shu stolda");

    const targetRecord = await prisma.table.findFirst({
      where: { id: parsed.data.targetTableId, restaurantId: token.restaurantId },
      select: { id: true },
    });
    if (!targetRecord) return notFound("Yangi stol topilmadi");
    const target = await syncTableState(prisma, parsed.data.targetTableId, token.restaurantId);
    if (target.status !== "FREE") return forbidden("Tanlangan stol band");

    const order = await prisma.$transaction(async (tx) => {
      const claimedTarget = await tx.table.updateMany({
        where: { id: target.id, restaurantId: token.restaurantId, status: "FREE", currentOrderId: null },
          data: { status: existing.status === "BILL" ? "BILL_REQUESTED" : "OCCUPIED", currentOrderId: existing.id },
      });
      if (claimedTarget.count !== 1) throw new Error("TARGET_TABLE_BUSY");

      const order = await tx.order.update({
        where: { id: existing.id },
        data: { tableId: target.id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          table: { select: { id: true, number: true, status: true, zone: { select: { id: true, name: true } } } },
        },
      });
      await syncTableState(tx, existing.tableId, token.restaurantId);
      await syncTableState(tx, target.id, token.restaurantId);
      return order;
    });

    await Promise.all([
      writeAuditLog(request, {
        restaurantId: token.restaurantId,
        action: "TRANSFER_TABLE",
        entity: "Order",
        entityId: existing.id,
        metadata: { orderNumber: existing.orderNumber, fromTableId: existing.tableId, toTableId: target.id },
      }),
      publishEvent(restaurantChannel(token.restaurantId), "order:updated", order),
      publishEvent(restaurantChannel(token.restaurantId), "table:status", { tableId: existing.tableId, status: "FREE", currentOrderId: null }),
      publishEvent(restaurantChannel(token.restaurantId), "table:status", { tableId: target.id, status: order.table.status, currentOrderId: existing.id }),
    ]);
    return success(order);
  } catch (error) {
    if (error instanceof Error && error.message === "TARGET_TABLE_BUSY") return forbidden("Tanlangan stol hozirgina band bo'ldi");
    console.error("[Transfer Order Error]", error);
    return serverError("Chekni boshqa stolga ko'chirishda xato");
  }
}
