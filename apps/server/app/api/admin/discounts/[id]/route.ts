import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { unauthorized, badRequest, serverError, success, notFound } from "@/lib/responses";
import { getRestaurantToken, zodMessage } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";
import { publishEvent, restaurantChannel } from "@/lib/pusher";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

const updateDiscountSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["PERCENT", "FIXED"]).optional(),
  value: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
});

type UpdateDiscountRequest = z.infer<typeof updateDiscountSchema>;
const readRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;
const writeRoles = [UserRole.ADMIN] as const;

/**
 * GET /api/admin/discounts/[id]
 * Get discount details (ADMIN, MANAGER, CASHIER)
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, readRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const discount = await prisma.discount.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!discount) {
      return notFound("Chegirma topilmadi");
    }

    return success(discount);
  } catch (error) {
    console.error("[Get Discount Error]", error);
    return serverError("Chegirma ma'lumotini olishda xato");
  }
}

/**
 * PUT /api/admin/discounts/[id]
 * Update discount (ADMIN only)
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    // Check if discount exists and belongs to this restaurant
    const existingDiscount = await prisma.discount.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: { id: true, type: true, value: true },
    });

    if (!existingDiscount) {
      return notFound("Chegirma topilmadi");
    }

    const body = await request.json();
    const parseResult = updateDiscountSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest(zodMessage(parseResult.error));
    }

    const data = parseResult.data as UpdateDiscountRequest;

    // If name is changing, check uniqueness
    if (data.name) {
      const existing = await prisma.discount.findFirst({
        where: {
          restaurantId: token.restaurantId,
          name: data.name,
          id: { not: params.id },
        },
      });

      if (existing) {
        return badRequest("Bu nom bilan chegirma allaqachon mavjud");
      }
    }

    // Validate value
    const nextType = data.type ?? existingDiscount.type;
    const nextValue = data.value ?? existingDiscount.value;
    if (nextType === "PERCENT" && nextValue > 100) {
      return badRequest("Foiz 100 dan oshmasligi kerak");
    }

    const updated = await prisma.discount.update({
      where: { id: params.id },
      data,
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "discount:updated", {
      action: "updated",
      discount: updated,
    });

    return success(updated);
  } catch (error) {
    console.error("[Update Discount Error]", error);
    return serverError("Chegirma yangilashda xato");
  }
}

/**
 * DELETE /api/admin/discounts/[id]
 * Delete discount (ADMIN only - soft delete)
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, writeRoles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    // Check if discount exists and belongs to this restaurant
    const existingDiscount = await prisma.discount.findFirst({
      where: { id: params.id, restaurantId: token.restaurantId },
      select: { id: true },
    });

    if (!existingDiscount) {
      return notFound("Chegirma topilmadi");
    }

    // Soft delete
    const updated = await prisma.discount.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    await publishEvent(restaurantChannel(token.restaurantId), "discount:updated", {
      action: "deleted",
      discount: updated,
    });

    return success({
      message: "Chegirma deaktivatsiya qilindi",
      discount: updated,
    });
  } catch (error) {
    console.error("[Delete Discount Error]", error);
    return serverError("Chegirma o'chirishda xato");
  }
}
