import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publishEvent, restaurantChannel } from "@/lib/pusher";
import { badRequest, forbidden, notFound, serverError, success, unauthorized } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ id: string; categoryId: string }> };

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  emoji: z.string().max(8).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const roles = [UserRole.ADMIN, UserRole.MANAGER] as const;

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(zodMessage(parsed.error));

    const existing = await prisma.menuCategory.findFirst({
      where: { id: params.categoryId, restaurantId: token.restaurantId },
      select: { id: true },
    });
    if (!existing) return notFound("Kategoriya topilmadi");

    const category = await prisma.menuCategory.update({
      where: { id: params.categoryId },
      data: parsed.data,
      select: { id: true, name: true, emoji: true, sortOrder: true, isActive: true },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "menu:updated", {
      action: "category:updated",
      category,
    });

    return success(category);
  } catch (error) {
    console.error("[Update Menu Category Error]", error);
    return serverError("Kategoriyani yangilashda xato");
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");
    if (token.restaurantId !== params.id) return forbidden("Boshqa restoran ma'lumotiga ruxsat yo'q");

    const category = await prisma.menuCategory.findFirst({
      where: { id: params.categoryId, restaurantId: token.restaurantId },
      select: { id: true },
    });
    if (!category) return notFound("Kategoriya topilmadi");

    const updated = await prisma.menuCategory.update({
      where: { id: params.categoryId },
      data: { isActive: false, items: { updateMany: { where: {}, data: { isActive: false } } } },
      select: { id: true, isActive: true },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "menu:updated", {
      action: "category:deleted",
      categoryId: updated.id,
    });

    return success(updated);
  } catch (error) {
    console.error("[Delete Menu Category Error]", error);
    return serverError("Kategoriyani o'chirishda xato");
  }
}
