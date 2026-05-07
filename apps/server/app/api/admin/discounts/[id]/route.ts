import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError, success, notFound } from "@/lib/responses";
import { UserToken } from "@restopos/types";

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

/**
 * GET /api/admin/discounts/[id]
 * Get discount details (ADMIN, MANAGER, CASHIER)
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (!["ADMIN", "MANAGER", "CASHIER"].includes(token.role)) {
      return forbidden("Ruxsat kerak");
    }

    const discount = await prisma.discount.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!discount) {
      return notFound("Chegirma topilmadi");
    }

    // Check permission
    if (discount.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran chegirmasini ko'ra olmaysiz");
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
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (token.role !== "ADMIN") {
      return forbidden("Admin ruxsat kerak");
    }

    // Check if discount exists and belongs to this restaurant
    const existingDiscount = await prisma.discount.findUnique({
      where: { id: params.id },
      select: { restaurantId: true },
    });

    if (!existingDiscount) {
      return notFound("Chegirma topilmadi");
    }

    if (existingDiscount.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran chegirmasini tahrirlaya olmaysiz");
    }

    const body = await request.json();
    const parseResult = updateDiscountSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest(
        parseResult.error.errors[0]?.message || "Validation error"
      );
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
    if (data.value !== undefined) {
      if (data.value < 1) {
        return badRequest("Qiymat 1 dan katta bo'lishi kerak");
      }

      // If type is PERCENT, validate percentage
      const discount = await prisma.discount.findUnique({
        where: { id: params.id },
        select: { type: true },
      });

      if (
        (data.type === "PERCENT" || discount?.type === "PERCENT") &&
        data.value > 100
      ) {
        return badRequest("Foiz 100 dan oshmasligi kerak");
      }
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
    const auth = await getAuthContext(request);

    if (!auth.isRestaurantUser) {
      return unauthorized("Kirish uchun login qiling");
    }

    const token = auth.token as UserToken;

    if (token.role !== "ADMIN") {
      return forbidden("Admin ruxsat kerak");
    }

    // Check if discount exists and belongs to this restaurant
    const existingDiscount = await prisma.discount.findUnique({
      where: { id: params.id },
      select: { restaurantId: true },
    });

    if (!existingDiscount) {
      return notFound("Chegirma topilmadi");
    }

    if (existingDiscount.restaurantId !== token.restaurantId) {
      return forbidden("Boshqa restoran chegirmasini o'chira olmaysiz");
    }

    // Soft delete
    const updated = await prisma.discount.update({
      where: { id: params.id },
      data: { isActive: false },
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
