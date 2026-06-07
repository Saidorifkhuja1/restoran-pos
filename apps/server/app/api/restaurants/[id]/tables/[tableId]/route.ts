import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { syncTableState } from "@/lib/table-status";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string; tableId: string }> };

const updateSchema = z.object({
  zoneId: z.string().min(1).optional(),
  number: z.number().int().positive().optional(),
  capacity: z.number().int().positive().optional(),
  shape: z.enum(["SQUARE", "ROUND", "RECTANGLE"]).optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
}).strict();

const readRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER] as const;
const writeRoles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, readRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const table = await prisma.table.findFirst({
      where: { id: params.tableId, restaurantId: token.restaurantId },
      select: {
        id: true,
        number: true,
        capacity: true,
        shape: true,
        posX: true,
        posY: true,
        status: true,
        currentOrderId: true,
        zone: { select: { id: true, name: true, color: true } },
        orders: {
          where: {
            status: { notIn: ["PAID", "CANCELLED"] },
            OR: [{ note: null }, { note: { notIn: ["Kuryer", "Olib ketish"] } }],
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true, status: true },
        },
      },
    });
    if (!table) return notFound("Stol topilmadi");
    const { orders, ...data } = table;
    const activeOrder = orders[0];
    return success(
      activeOrder
        ? {
            ...data,
            status: activeOrder.status === "BILL" ? "BILL_REQUESTED" : "OCCUPIED",
            currentOrderId: activeOrder.id,
          }
        : { ...data, status: data.status === "RESERVED" ? data.status : "FREE", currentOrderId: null }
    );
  } catch (error) {
    console.error("[Get Table Error]", error);
    return serverError("Stolni olishda xato");
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const existing = await prisma.table.findFirst({
      where: { id: params.tableId, restaurantId: token.restaurantId },
      select: { id: true },
    });
    if (!existing) return notFound("Stol topilmadi");

    if (parsed.data.zoneId) {
      const zone = await prisma.zone.findFirst({
        where: { id: parsed.data.zoneId, restaurantId: token.restaurantId, isActive: true },
        select: { id: true },
      });
      if (!zone) return badRequest("Zona topilmadi");
    }

    await prisma.table.update({
      where: { id: params.tableId },
      data: parsed.data,
    });
    const table = await syncTableState(prisma, params.tableId, token.restaurantId);
    const updated = await prisma.table.findUnique({
      where: { id: params.tableId },
      select: {
        id: true,
        number: true,
        capacity: true,
        shape: true,
        posX: true,
        posY: true,
        status: true,
        currentOrderId: true,
      },
    });
    if (!updated) return notFound("Stol topilmadi");

    await publishEvent(restaurantChannel(token.restaurantId), "table:status", table);
    return success(updated);
  } catch (error) {
    console.error("[Update Table Error]", error);
    return serverError("Stolni yangilashda xato");
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const table = await prisma.table.findFirst({
      where: { id: params.tableId, restaurantId: token.restaurantId },
      select: {
        id: true,
        status: true,
        _count: { select: { orders: true, reservations: true } },
      },
    });
    if (!table) return notFound("Stol topilmadi");
    if (table.status !== "FREE") return forbidden("Band stolni o'chirib bo'lmaydi");
    if (table._count.orders > 0 || table._count.reservations > 0) {
      return forbidden("Tarixiy buyurtma yoki bronlari bor stolni o'chirib bo'lmaydi");
    }

    await prisma.table.delete({ where: { id: params.tableId } });
    await publishEvent(restaurantChannel(token.restaurantId), "table:status", {
      tableId: params.tableId,
      deleted: true,
    });
    return success({ id: params.tableId });
  } catch (error) {
    console.error("[Delete Table Error]", error);
    return serverError("Stolni o'chirishda xato");
  }
}
