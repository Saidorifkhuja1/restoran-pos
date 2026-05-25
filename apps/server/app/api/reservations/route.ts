import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

const reservationSchema = z.object({
  tableId: z.string().min(1),
  guestName: z.string().min(2).max(120),
  guestPhone: z.string().max(40).optional(),
  guestCount: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});

const statusQuerySchema = z
  .enum(["PENDING", "CONFIRMED", "ARRIVED", "CANCELLED", "NO_SHOW"])
  .optional();

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER] as const;

export async function GET(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const { searchParams } = new URL(request.url);
    const parsedStatus = statusQuerySchema.safeParse(searchParams.get("status") || undefined);
    if (!parsedStatus.success) return badRequest(zodMessage(parsedStatus.error));

    const { page, limit, skip } = getPagination(request);
    const where: Prisma.ReservationWhereInput = {
      restaurantId: token.restaurantId,
      ...(parsedStatus.data ? { status: parsedStatus.data } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          guestName: true,
          guestPhone: true,
          guestCount: true,
          scheduledAt: true,
          note: true,
          status: true,
          arrivedAt: true,
          table: { select: { id: true, number: true, status: true } },
          user: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
        },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.reservation.count({ where }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Get Reservations Error]", error);
    return serverError("Bronlarni olishda xato");
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = reservationSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const table = await prisma.table.findFirst({
      where: { id: parsed.data.tableId, restaurantId: token.restaurantId },
      select: { id: true, status: true },
    });
    if (!table) return badRequest("Stol topilmadi");
    if (table.status === "OCCUPIED" || table.status === "BILL_REQUESTED") {
      return forbidden("Bu stol band");
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          restaurantId: token.restaurantId,
          tableId: parsed.data.tableId,
          guestName: parsed.data.guestName,
          guestPhone: parsed.data.guestPhone,
          guestCount: parsed.data.guestCount,
          scheduledAt: new Date(parsed.data.scheduledAt),
          note: parsed.data.note,
          status: "CONFIRMED",
          createdBy: token.userId,
        },
        select: {
          id: true,
          guestName: true,
          guestPhone: true,
          guestCount: true,
          scheduledAt: true,
          note: true,
          status: true,
          tableId: true,
        },
      });

      await tx.table.update({
        where: { id: parsed.data.tableId },
        data: { status: "RESERVED" },
      });

      return created;
    });

    await Promise.all([
      publishEvent(restaurantChannel(token.restaurantId), "reservation:created", reservation),
      publishEvent(restaurantChannel(token.restaurantId), "table:status", {
        tableId: reservation.tableId,
        status: "RESERVED",
      }),
    ]);

    return success(reservation, 201);
  } catch (error) {
    console.error("[Create Reservation Error]", error);
    return serverError("Bron yaratishda xato");
  }
}
