import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  emoji: z.string().max(8).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const readRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER] as const;
const writeRoles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, readRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const { page, limit, skip } = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.menuCategory.findMany({
        where: { restaurantId: token.restaurantId },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          emoji: true,
          sortOrder: true,
          isActive: true,
          _count: { select: { items: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.menuCategory.count({ where: { restaurantId: token.restaurantId } }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Get Menu Categories Error]", error);
    return serverError("Kategoriyalarni olishda xato");
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const parsed = categorySchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const category = await prisma.menuCategory.create({
      data: { ...parsed.data, restaurantId: token.restaurantId },
      select: {
        id: true,
        name: true,
        emoji: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
      },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "menu:updated", {
      action: "category:created",
      category,
    });

    return success(category, 201);
  } catch (error) {
    console.error("[Create Menu Category Error]", error);
    return serverError("Kategoriya yaratishda xato");
  }
}
