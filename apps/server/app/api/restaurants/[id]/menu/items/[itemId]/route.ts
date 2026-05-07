import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";
import { writeAuditLog } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

const updateSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z.number().int().positive().optional(),
  emoji: z.string().max(8).nullable().optional(),
  image: z.string().url().nullable().optional(),
  preparationTime: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

const readRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER] as const;
const writeRoles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, readRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const item = await prisma.menuItem.findFirst({
      where: { id: params.itemId, restaurantId: token.restaurantId },
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
        category: { select: { id: true, name: true } },
      },
    });
    if (!item) return notFound("Menyu elementi topilmadi");
    return success(item);
  } catch (error) {
    console.error("[Get Menu Item Error]", error);
    return serverError("Menyu elementini olishda xato");
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

    const existing = await prisma.menuItem.findFirst({
      where: { id: params.itemId, restaurantId: token.restaurantId },
      select: { id: true },
    });
    if (!existing) return notFound("Menyu elementi topilmadi");

    if (parsed.data.categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: { id: parsed.data.categoryId, restaurantId: token.restaurantId },
        select: { id: true },
      });
      if (!category) return badRequest("Kategoriya topilmadi");
    }

    const item = await prisma.menuItem.update({
      where: { id: params.itemId },
      data: parsed.data,
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
      },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "UPDATE",
      entity: "MenuItem",
      entityId: item.id,
      metadata: { name: item.name, price: item.price, isActive: item.isActive, isAvailable: item.isAvailable },
    });

    return success(item);
  } catch (error) {
    console.error("[Update Menu Item Error]", error);
    return serverError("Menyu elementini yangilashda xato");
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const existing = await prisma.menuItem.findFirst({
      where: { id: params.itemId, restaurantId: token.restaurantId },
      select: { id: true },
    });
    if (!existing) return notFound("Menyu elementi topilmadi");

    const item = await prisma.menuItem.update({
      where: { id: params.itemId },
      data: { isActive: false, isAvailable: false },
      select: { id: true, isActive: true, isAvailable: true },
    });

    await writeAuditLog(request, {
      restaurantId: token.restaurantId,
      action: "DELETE",
      entity: "MenuItem",
      entityId: item.id,
    });

    return success(item);
  } catch (error) {
    console.error("[Delete Menu Item Error]", error);
    return serverError("Menyu elementini o'chirishda xato");
  }
}
