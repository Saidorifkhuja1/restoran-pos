import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { kitchenChannel, publishEvent, restaurantChannel } from "@/lib/pusher";
import { writeAuditLog } from "@/lib/audit";
import { UserRole } from "@restopos/types";

const orderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  note: z.string().max(300).optional(),
});

const createOrderSchema = z.object({
  tableId: z.string().min(1),
  reservationId: z.string().min(1).optional(),
  waiterId: z.string().min(1).optional(),
  guestCount: z.number().int().positive(),
  note: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1),
});

const orderStatusQuerySchema = z
  .enum(["OPEN", "IN_KITCHEN", "READY", "BILL", "PAID", "CANCELLED"])
  .optional();

const readRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;
const createRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER] as const;

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, readRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const { searchParams } = new URL(request.url);
    const parsedStatus = orderStatusQuerySchema.safeParse(searchParams.get("status") || undefined);
    if (!parsedStatus.success) return badRequest(zodMessage(parsedStatus.error));
    const status = parsedStatus.data;
    const tableId = searchParams.get("tableId") || undefined;
    const active = searchParams.get("active") === "true";
    const scope = searchParams.get("scope");
    const { page, limit, skip } = getPagination(request);
    const shouldLimitToWaiter = token.role === UserRole.WAITER && scope !== "restaurant";
    const where: Prisma.OrderWhereInput = {
      restaurantId: token.restaurantId,
      ...(active ? { status: { notIn: ["PAID", "CANCELLED"] } } : status ? { status } : {}),
      ...(tableId ? { tableId } : {}),
      ...(shouldLimitToWaiter ? { waiterId: token.userId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          guestCount: true,
          note: true,
          createdAt: true,
          sentToKitchenAt: true,
          readyAt: true,
          billedAt: true,
          paidAt: true,
          table: { select: { id: true, number: true, status: true, zone: { select: { id: true, name: true } } } },
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
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Get Orders Error]", error);
    return serverError("Buyurtmalarni olishda xato");
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, createRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = createOrderSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const data = parsed.data;
    const table = await prisma.table.findFirst({
      where: { id: data.tableId, restaurantId: token.restaurantId },
      select: { id: true, status: true },
    });
    if (!table) return badRequest("Stol topilmadi");
    if (table.status !== "FREE") return forbidden("Bu joy band. To'lov qilinmaguncha yangi chek ochib bo'lmaydi");

    let waiterId = token.userId;
    if (token.role === UserRole.CASHIER) {
      if (!data.waiterId) return badRequest("Kassir chek yaratishi uchun ofitsiant tanlash majburiy");
      const waiter = await prisma.user.findFirst({
        where: { id: data.waiterId, restaurantId: token.restaurantId, role: UserRole.WAITER, isActive: true },
        select: { id: true },
      });
      if (!waiter) return badRequest("Ofitsiant topilmadi");
      waiterId = waiter.id;
    } else if (data.waiterId) {
      if (token.role === UserRole.WAITER && data.waiterId !== token.userId) {
        return forbidden("Boshqa ofitsiant nomidan chek yaratib bo'lmaydi");
      }
      const waiter = await prisma.user.findFirst({
        where: { id: data.waiterId, restaurantId: token.restaurantId, role: UserRole.WAITER, isActive: true },
        select: { id: true },
      });
      if (!waiter) return badRequest("Ofitsiant topilmadi");
      waiterId = waiter.id;
    }

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
          tableId: data.tableId,
          reservationId: data.reservationId,
          waiterId,
          orderNumber: counter.orderSeq,
          guestCount: data.guestCount,
          note: data.note,
          status: "IN_KITCHEN",
          sentToKitchenAt: new Date(),
          items: {
            create: data.items.map((item) => {
              const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
              if (!menuItem) throw new Error("Menu item snapshot missing");
              return {
                menuItemId: item.menuItemId,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity,
                note: item.note,
                status: "COOKING",
              };
            }),
          },
        },
        select: {
          id: true,
          restaurantId: true,
          orderNumber: true,
          status: true,
          guestCount: true,
          sentToKitchenAt: true,
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
            },
          },
        },
      });

      await tx.table.update({
        where: { id: data.tableId },
        data: { status: "OCCUPIED", currentOrderId: created.id },
      });

      return created;
    });

    await Promise.all([
      writeAuditLog(request, {
        restaurantId: token.restaurantId,
        action: "CREATE",
        entity: "Order",
        entityId: order.id,
        metadata: { orderNumber: order.orderNumber, tableId: data.tableId },
      }),
      publishEvent(restaurantChannel(token.restaurantId), "order:created", order),
      publishEvent(kitchenChannel(token.restaurantId), "new-order", order),
      publishEvent(restaurantChannel(token.restaurantId), "table:status", {
        tableId: data.tableId,
        status: "OCCUPIED",
        currentOrderId: order.id,
      }),
    ]);

    return success(order, 201);
  } catch (error) {
    console.error("[Create Order Error]", error);
    return serverError("Buyurtma yaratishda xato");
  }
}
