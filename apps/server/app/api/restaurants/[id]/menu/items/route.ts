import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, serverError, success, unauthorized } from "@/lib/responses";
import { getPagination, getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";
import { writeAuditLog } from "@/lib/audit";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const menuItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  price: z.number().int().positive(),
  emoji: z.string().max(8).optional(),
  image: z.string().url().optional(),
  preparationTime: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
});

const readRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;
const writeRoles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, readRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const { page, limit, skip } = getPagination(request);
    const where = { restaurantId: token.restaurantId, ...(categoryId ? { categoryId } : {}) };

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          categoryId: true,
          name: true,
          description: true,
          price: true,
          emoji: true,
          image: true,
          preparationTime: true,
          isActive: true,
          isAvailable: true,
          category: { select: { id: true, name: true, emoji: true } },
        },
        orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      }),
      prisma.menuItem.count({ where }),
    ]);

    return success({ items, total, page, limit });
  } catch (error) {
    console.error("[Get Menu Items Error]", error);
    return serverError("Menyu elementlarini olishda xato");
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const parsed = menuItemSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const category = await prisma.menuCategory.findFirst({
      where: { id: parsed.data.categoryId, restaurantId: token.restaurantId, isActive: true },
      select: { id: true },
    });
    if (!category) return badRequest("Kategoriya topilmadi");

    const item = await prisma.menuItem.create({
      data: { ...parsed.data, restaurantId: token.restaurantId },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        price: true,
        emoji: true,
        image: true,
        preparationTime: true,
        isActive: true,
        isAvailable: true,
        createdAt: true,
      },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "CREATE",
      entity: "MenuItem",
      entityId: item.id,
      metadata: { name: item.name, price: item.price },
    });

    return success(item, 201);
  } catch (error) {
    console.error("[Create Menu Item Error]", error);
    return serverError("Menyu elementi yaratishda xato");
  }
}
