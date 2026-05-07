import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken, isRestaurantRole, zodMessage } from "@/lib/route-helpers";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { UserRole } from "@restopos/types";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const tableSchema = z.object({
  zoneId: z.string().min(1),
  number: z.number().int().positive(),
  capacity: z.number().int().positive(),
  shape: z.enum(["SQUARE", "ROUND", "RECTANGLE"]),
  posX: z.number().default(0),
  posY: z.number().default(0),
});

const allowedRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER] as const;
const writeRoles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, allowedRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const { page, limit, skip } = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.table.findMany({
        where: { restaurantId: token.restaurantId },
        skip,
        take: limit,
        select: {
          id: true,
          restaurantId: true,
          zoneId: true,
          number: true,
          capacity: true,
          shape: true,
          posX: true,
          posY: true,
          status: true,
          currentOrderId: true,
          zone: { select: { id: true, name: true, color: true } },
        },
        orderBy: [{ zone: { sortOrder: "asc" } }, { number: "asc" }],
      }),
      prisma.table.count({ where: { restaurantId: token.restaurantId } }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Get Tables Error]", error);
    return serverError("Stollarni olishda xato");
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (!isRestaurantRole(token, writeRoles)) return forbidden("Ruxsat kerak");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const parsed = tableSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const zone = await prisma.zone.findFirst({
      where: { id: parsed.data.zoneId, restaurantId: token.restaurantId, isActive: true },
      select: { id: true },
    });
    if (!zone) return badRequest("Zona topilmadi");

    const table = await prisma.table.create({
      data: { ...parsed.data, restaurantId: token.restaurantId },
      select: {
        id: true,
        restaurantId: true,
        zoneId: true,
        number: true,
        capacity: true,
        shape: true,
        posX: true,
        posY: true,
        status: true,
        currentOrderId: true,
      },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "table:status", table);
    return success(table, 201);
  } catch (error) {
    console.error("[Create Table Error]", error);
    return serverError("Stol yaratishda xato");
  }
}
