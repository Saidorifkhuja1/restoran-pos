import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, unauthorized, notFound, badRequest, serverError, success } from "@/lib/responses";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

const updateRestaurantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  type: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  receiptFooter: z.string().optional(),
});

type UpdateRestaurantRequest = z.infer<typeof updateRestaurantSchema>;

/**
 * GET /api/superadmin/restaurants/[id]
 * Get restaurant details (SuperAdmin only)
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);

    if (!auth.isSuperAdmin) {
      return unauthorized("SuperAdmin ruxsat kerak");
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: params.id },
      include: {
        settings: true,
        users: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            tables: true,
            orders: true,
          },
        },
      },
    });

    if (!restaurant) {
      return notFound("Restoran topilmadi");
    }

    return success(restaurant);
  } catch (error) {
    console.error("[Get Restaurant Error]", error);
    return serverError("Restoranni olishda xato");
  }
}

/**
 * PUT /api/superadmin/restaurants/[id]
 * Update restaurant (SuperAdmin only)
 */
export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);

    if (!auth.isSuperAdmin) {
      return unauthorized("SuperAdmin ruxsat kerak");
    }

    // Check restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: params.id },
    });

    if (!restaurant) {
      return notFound("Restoran topilmadi");
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
      where: { id: params.id },
      data,
      include: {
        settings: true,
      },
    });

    return success(updated);
  } catch (error) {
    console.error("[Update Restaurant Error]", error);
    return serverError("Restoranni yangilashda xato");
  }
}

/**
 * DELETE /api/superadmin/restaurants/[id]
 * Delete restaurant (SuperAdmin only - soft delete)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const params = await context.params;
    const auth = await getAuthContext(request);

    if (!auth.isSuperAdmin) {
      return unauthorized("SuperAdmin ruxsat kerak");
    }

    // Check restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: params.id },
    });

    if (!restaurant) {
      return notFound("Restoran topilmadi");
    }

    // Soft delete - deactivate restaurant
    const updated = await prisma.restaurant.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return success({
      message: "Restoran deaktivatsiya qilindi",
      restaurant: updated,
    });
  } catch (error) {
    console.error("[Delete Restaurant Error]", error);
    return serverError("Restoranni o'chirishda xato");
  }
}
