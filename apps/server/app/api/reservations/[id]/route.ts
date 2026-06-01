import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  guestName: z.string().min(2).max(120).optional(),
  guestPhone: z.string().max(40).nullable().optional(),
  guestCount: z.number().int().positive().optional(),
  scheduledAt: z.string().datetime().optional(),
  note: z.string().max(500).nullable().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW"]).optional(),
});

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER] as const;

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const reservation = await prisma.reservation.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
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
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });

    if (!reservation) return notFound("Bron topilmadi");
    return success(reservation);
  } catch (error) {
    console.error("[Get Reservation Error]", error);
    return serverError("Bronni olishda xato");
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const existing = await prisma.reservation.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: { id: true, tableId: true },
    });
    if (!existing) return notFound("Bron topilmadi");

    const shouldReleaseTable = parsed.data.status === "CANCELLED" || parsed.data.status === "NO_SHOW";
    const reservation = await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id: params.id },
        data: {
          ...parsed.data,
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
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

      if (shouldReleaseTable) {
        await tx.table.updateMany({
          where: { id: existing.tableId, restaurantId: token.restaurantId, status: "RESERVED" },
          data: { status: "FREE" },
        });
      }

      return updated;
    });

    const events = [
      publishEvent(restaurantChannel(token.restaurantId), "reservation:updated", reservation),
    ];
    if (shouldReleaseTable) {
      events.push(
        publishEvent(restaurantChannel(token.restaurantId), "table:status", {
          tableId: existing.tableId,
          status: "FREE",
        })
      );
    }
    await Promise.all(events);

    return success(reservation);
  } catch (error) {
    console.error("[Update Reservation Error]", error);
    return serverError("Bronni yangilashda xato");
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const reservation = await prisma.reservation.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: { id: true, tableId: true, status: true },
    });
    if (!reservation) return notFound("Bron topilmadi");
    if (reservation.status === "ARRIVED") return forbidden("Kelgan bronni o'chirib bo'lmaydi");

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.reservation.update({
        where: { id: params.id },
        data: { status: "CANCELLED" },
        select: { id: true, status: true },
      });

      await tx.table.updateMany({
        where: { id: reservation.tableId, restaurantId: token.restaurantId, status: "RESERVED" },
        data: { status: "FREE" },
      });

      return cancelled;
    });

    await Promise.all([
      publishEvent(restaurantChannel(token.restaurantId), "reservation:deleted", updated),
      publishEvent(restaurantChannel(token.restaurantId), "table:status", {
        tableId: reservation.tableId,
        status: "FREE",
      }),
    ]);

    return success(updated);
  } catch (error) {
    console.error("[Delete Reservation Error]", error);
    return serverError("Bronni o'chirishda xato");
  }
}
