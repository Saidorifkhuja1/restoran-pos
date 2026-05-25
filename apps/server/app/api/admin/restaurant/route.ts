import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError, success } from "@/lib/responses";
import { UserToken } from "@restopos/types";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

const updateRestaurantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logo: z.string().url().nullable().optional(),
  type: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  taxPercent: z.number().min(0, "QQS 0 dan kichik bo'lmasin").max(100, "QQS 100 dan oshmasin").optional(),
  receiptFooter: z.string().nullable().optional(),
  currency: z.string().length(3).optional(),
});

type UpdateRestaurantRequest = z.infer<typeof updateRestaurantSchema>;

/**
 * GET /api/admin/restaurant
 * Get current restaurant (ADMIN only)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (token.role !== "ADMIN") {
      return forbidden("Admin ruxsat kerak");
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: token.restaurantId },
      include: {
        settings: true,
        _count: {
          select: {
            users: true,
            tables: true,
            orders: true,
          },
        },
      },
    });

    if (!restaurant) {
      return unauthorized("Restoran topilmadi");
    }

    return success(restaurant);
  } catch (error) {
    console.error("[Get Restaurant Error]", error);
    return serverError("Restoran ma'lumotini olishda xato");
  }
}

/**
 * PUT /api/admin/restaurant
 * Update restaurant (ADMIN only, DELETE forbidden)
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (token.role !== "ADMIN") {
      return forbidden("Admin ruxsat kerak");
    }

    const body = await request.json();
    const parseResult = updateRestaurantSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest(
        parseResult.error.errors[0]?.message || "Validation error"
      );
    }

    const data = parseResult.data as UpdateRestaurantRequest;

    const updated = await prisma.restaurant.update({
      where: { id: token.restaurantId },
      data,
      include: {
        settings: true,
      },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "restaurant:updated", updated);

    return success(updated);
  } catch (error) {
    console.error("[Update Restaurant Error]", error);
    return serverError("Restoran yangilashda xato");
  }
}

/**
 * DELETE /api/admin/restaurant
 * Delete restaurant (FORBIDDEN - only SuperAdmin can delete)
 */
export async function DELETE() {
  return forbidden(
    "Restoran o'chirish uchun SuperAdmin ruxsat kerak. Admin restoranni o'chira olmaydi."
  );
}
